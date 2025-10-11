import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message, MessageDirection, MessageType } from './entities/message.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
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

    if (message.whatsappMessageId) {
      await this.whatsappService.markMessageAsRead(message.whatsappMessageId);
    }

    await this.messageRepository.update(messageId, {
      status: 'read' as any,
    });

    return this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['customer', 'user'],
    }) as Promise<Message>;
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