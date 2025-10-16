import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Message, MessageDirection, MessageType, MessageStatus } from './entities/message.entity';
import { Conversation, ConversationStatus } from '../conversations/entities/conversation.entity';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { ConversationsGateway } from '../conversations/conversations.gateway';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    private whatsappService: WhatsAppService,
    private conversationsGateway: ConversationsGateway,
  ) {}

  async findByConversation(conversationId: number): Promise<Message[]> {
    return this.messageRepository.find({
      where: { conversationId },
      relations: ['user', 'customer'],
      order: { createdAt: 'ASC' },
    });
  }

  async sendMessage(
    conversationId: number,
    customerId: number,
    content: string,
    userId: number,
    phoneNumber: string,
  ): Promise<Message> {
    // Send via WhatsApp API
    const whatsappResponse = await this.whatsappService.sendMessage(
      phoneNumber,
      content,
      userId,
    );

    // Save to database
    const message = this.messageRepository.create({
      conversationId,
      customerId,
      userId,
      content,
      direction: MessageDirection.OUTBOUND,
      messageType: MessageType.TEXT,
      whatsappMessageId: whatsappResponse.messages?.[0]?.id,
    });

    const savedMessage = await this.messageRepository.save(message);

    // Update conversation last message time
    await this.conversationRepository.update(conversationId, {
      lastMessageAt: new Date(),
    });

    // Load full message with relations
    const fullMessage = await this.messageRepository.findOne({
      where: { id: savedMessage.id },
      relations: ['customer', 'user'],
    });

    if (!fullMessage) {
      throw new Error(`Failed to load message with id ${savedMessage.id}`);
    }

    // Emit via WebSocket
    this.conversationsGateway.emitNewMessage(conversationId, fullMessage);
    this.conversationsGateway.emitConversationUpdate(conversationId, {
      lastMessageAt: new Date(),
    });

    return fullMessage;
  }

  async sendMediaMessage(
    conversationId: number,
    customerId: number,
    phoneNumber: string,
    mediaType: 'image' | 'video' | 'document' | 'audio',
    mediaUrl: string,
    userId: number,
    caption?: string,
  ): Promise<Message> {
    // Send via WhatsApp API
    const whatsappResponse = await this.whatsappService.sendMediaMessage(
      phoneNumber,
      mediaType,
      mediaUrl,
      caption,
    );

    // Save to database
    const message = this.messageRepository.create({
      conversationId,
      customerId,
      userId,
      content: caption || `[${mediaType}]`,
      mediaUrl,
      direction: MessageDirection.OUTBOUND,
      messageType: mediaType as MessageType,
      whatsappMessageId: whatsappResponse.messages?.[0]?.id,
    });

    const savedMessage = await this.messageRepository.save(message);

    // Update conversation
    await this.conversationRepository.update(conversationId, {
      lastMessageAt: new Date(),
    });

    // Load and emit
    const fullMessage = await this.messageRepository.findOne({
      where: { id: savedMessage.id },
      relations: ['customer', 'user'],
    });

    if (!fullMessage) {
      throw new Error(`Failed to load message with id ${savedMessage.id}`);
    }

    this.conversationsGateway.emitNewMessage(conversationId, fullMessage);
    this.conversationsGateway.emitConversationUpdate(conversationId, {
      lastMessageAt: new Date(),
    });

    return fullMessage;
  }

  async updateMessageStatus(whatsappMessageId: string, status: string) {
    await this.messageRepository.update(
      { whatsappMessageId },
      { status: status as any },
    );
  }

  async markAsRead(messageId: number): Promise<Message> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException(`Message with ID ${messageId} not found`);
    }

    // // Only mark as read if it's not already read
    // if (message.readAt) {
    //   return this.messageRepository.findOne({
    //     where: { id: messageId },
    //     relations: ['customer', 'user'],
    //   }) as Promise<Message>;
    // }

    if (message.direction !== MessageDirection.INBOUND) {
      throw new BadRequestException(
        `Cannot mark outgoing message as read. Only incoming messages from customers can be marked as read.`
      );
    }else if(message.readAt){
      return this.messageRepository.findOne({
        where: { id: messageId },
        relations: ['customer', 'user'],
      }) as Promise<Message>;
    }

    // Check if WhatsApp message ID is valid (not a test ID)
    const isValidWhatsAppId = message.whatsappMessageId && 
      !message.whatsappMessageId.includes('test') && 
      message.whatsappMessageId.startsWith('wamid.') &&
      message.whatsappMessageId.length > 20;

    if (isValidWhatsAppId) {
      try {
        await this.whatsappService.markMessageAsRead(message.whatsappMessageId);
      } catch (error) {
        console.error(`Failed to mark WhatsApp message as read: ${error.message}`);
        // Continue with local database update even if WhatsApp API fails
      }
    } else {
      console.log(`Skipping WhatsApp API call for test/invalid message ID: ${message.whatsappMessageId}`);
    }

    const readAt = new Date();
    await this.messageRepository.update(messageId, {
      status: MessageStatus.READ,
      readAt,
    });

    const updatedMessage = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['customer', 'user'],
    }) as Message;

    // Emit read status update via WebSocket
    this.conversationsGateway.emitMessageRead(message.conversationId, {
      messageId,
      readAt,
    });
    await this.updateConversationStatus(message.conversationId);

    return updatedMessage;
  }

  async markConversationAsRead(conversationId: number, userId?: number): Promise<void> {
    const whereCondition: any = {
      conversationId,
      readAt: null, 
      direction: MessageDirection.INBOUND, 
    };

    if (userId) {
      whereCondition.userId = userId;
    }

    const unreadMessages = await this.messageRepository.find({
      where: whereCondition,
      select: ['id', 'whatsappMessageId'],
    });

    if (unreadMessages.length === 0) {
      return;
    }

    const readAt = new Date();
    const messageIds = unreadMessages.map(msg => msg.id);

    await this.messageRepository.update(
      messageIds,
      {
        status: MessageStatus.READ,
        readAt,
      }
    );

    const whatsappMessageIds = unreadMessages
      .filter(msg => msg.whatsappMessageId)
      .map(msg => msg.whatsappMessageId);

    if (whatsappMessageIds.length > 0) {
      for (const whatsappId of whatsappMessageIds) {
        try {
          await this.whatsappService.markMessageAsRead(whatsappId);
        } catch (error) {
          console.error(`Failed to mark WhatsApp message ${whatsappId} as read:`, error);
        }
      }
    }

    this.conversationsGateway.emitConversationRead(conversationId, {
      messageIds,
      readAt,
    });
    await this.updateConversationStatus(conversationId);
  }

  async getUnreadCount(conversationId?: number, userId?: number): Promise<number> {
    console.log('🔍 DEBUG - getUnreadCount called with:', { conversationId, userId });
    
    const queryBuilder = this.messageRepository.createQueryBuilder('message')
      .leftJoin('message.conversation', 'conversation')
      .where('message.readAt IS NULL')
      .andWhere('message.direction = :direction', { direction: MessageDirection.INBOUND });

    if (conversationId) {
      queryBuilder.andWhere('message.conversationId = :conversationId', { conversationId });
      console.log('🔍 DEBUG - Filtering by conversationId:', conversationId);
    }

    if (userId) {
      // Filter by conversations assigned to the user OR unassigned conversations
      queryBuilder.andWhere(
        '(conversation.assignedUserId = :userId OR conversation.assignedUserId IS NULL)',
        { userId }
      );
      console.log('🔍 DEBUG - Filtering by assignedUserId OR unassigned:', userId);
    }

    // Log the generated SQL for debugging
    const sql = queryBuilder.getSql();
    const parameters = queryBuilder.getParameters();
    console.log('🔍 DEBUG - Generated SQL:', sql);
    console.log('🔍 DEBUG - SQL Parameters:', parameters);

    const count = await queryBuilder.getCount();
    console.log('🔍 DEBUG - Unread count result:', count);
    
    return count;
  }

  async getUnreadMessages(conversationId?: number, userId?: number): Promise<Message[]> {
    const queryBuilder = this.messageRepository.createQueryBuilder('message')
      .leftJoinAndSelect('message.conversation', 'conversation')
      .leftJoinAndSelect('message.customer', 'customer')
      .leftJoinAndSelect('message.user', 'user')
      .where('message.readAt IS NULL')
      .andWhere('message.direction = :direction', { direction: MessageDirection.INBOUND })
      .orderBy('message.createdAt', 'DESC');

    if (conversationId) {
      queryBuilder.andWhere('message.conversationId = :conversationId', { conversationId });
    }

    if (userId) {
      // Filter by conversations assigned to the user OR unassigned conversations
      queryBuilder.andWhere(
        '(conversation.assignedUserId = :userId OR conversation.assignedUserId IS NULL)',
        { userId }
      );
    }

    return queryBuilder.getMany();
  }

  private async updateConversationStatus(conversationId: number): Promise<void> {
    // Check if there are any unread incoming messages in this conversation
    const unreadIncomingCount = await this.messageRepository.count({
      where: {
        conversationId,
        readAt: IsNull(),
        direction: MessageDirection.INBOUND, // Only count incoming messages from clients
      },
    });

    // Get current conversation
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      return;
    }

    // Determine new status based on unread incoming messages
    const newStatus = unreadIncomingCount > 0 ? ConversationStatus.OPEN : ConversationStatus.CLOSED;
    
    // Only update if status has changed
    if (conversation.status !== newStatus) {
      await this.conversationRepository.update(conversationId, {
        status: newStatus,
      });

      // Emit conversation status update via WebSocket
      this.conversationsGateway.emitConversationUpdate(conversationId, {
        status: newStatus,
        unreadIncomingCount,
      });

      console.log(`Conversation ${conversationId} status updated to ${newStatus} (unread incoming messages: ${unreadIncomingCount})`);
    }
  }
  async getUnreadDiagnostics(userId: number) {
    console.log('🔍 DIAGNOSTICS - Starting unread diagnostics for userId:', userId);
    
    // 1. Check total messages
    const totalMessages = await this.messageRepository.count();
    console.log('📊 Total messages in database:', totalMessages);
    
    // 2. Check inbound messages
    const inboundMessages = await this.messageRepository.count({
      where: { direction: MessageDirection.INBOUND }
    });
    console.log('📊 Total inbound messages:', inboundMessages);
    
    // 3. Check unread inbound messages (no user filter)
    const unreadInbound = await this.messageRepository.count({
      where: { 
        direction: MessageDirection.INBOUND,
        readAt: IsNull()
      }
    });
    console.log('📊 Total unread inbound messages:', unreadInbound);
    
    // 4. Check conversations assigned to user
    const userConversations = await this.messageRepository
      .createQueryBuilder('message')
      .leftJoin('message.conversation', 'conversation')
      .select('DISTINCT(conversation.id)', 'conversationId')
      .addSelect('conversation.assignedUserId', 'assignedUserId')
      .where('conversation.assignedUserId = :userId', { userId })
      .getRawMany();
    console.log('📊 Conversations assigned to user:', userConversations);
    
    // 5. Check messages in user's conversations
    const messagesInUserConversations = await this.messageRepository
      .createQueryBuilder('message')
      .leftJoin('message.conversation', 'conversation')
      .where('conversation.assignedUserId = :userId', { userId })
      .andWhere('message.direction = :direction', { direction: MessageDirection.INBOUND })
      .getCount();
    console.log('📊 Inbound messages in user conversations:', messagesInUserConversations);
    
    // 6. Check unread messages in user's conversations
    const unreadInUserConversations = await this.messageRepository
      .createQueryBuilder('message')
      .leftJoin('message.conversation', 'conversation')
      .where('conversation.assignedUserId = :userId', { userId })
      .andWhere('message.direction = :direction', { direction: MessageDirection.INBOUND })
      .andWhere('message.readAt IS NULL')
      .getCount();
    console.log('📊 Unread inbound messages in user conversations:', unreadInUserConversations);
    
    return {
      userId,
      totalMessages,
      inboundMessages,
      unreadInbound,
      userConversations: userConversations.length,
      conversationDetails: userConversations,
      messagesInUserConversations,
      unreadInUserConversations,
      timestamp: new Date().toISOString()
    };
  }

  async getMessageStats(userId?: number) {
    const query = this.messageRepository.createQueryBuilder('message');

    if (userId) {
      query.where('message.userId = :userId', { userId });
    }

    const [totalMessages, sentMessages, receivedMessages] = await Promise.all([
      query.getCount(),
      query.clone().andWhere('message.direction = :direction', { direction: 'outbound' }).getCount(),
      query.clone().andWhere('message.direction = :direction', { direction: 'inbound' }).getCount(),
    ]);

    return {
      totalMessages,
      sentMessages,
      receivedMessages,
    };
  }
}