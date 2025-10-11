import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation, ConversationStatus } from './entities/conversation.entity';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
  ) {}

  async findAll(status?: ConversationStatus): Promise<Conversation[]> {
    const query: any = { 
      relations: ['customer', 'assignedUser'],
      order: { lastMessageAt: 'DESC' }
    };
    
    if (status) {
      query.where = { status };
    }

    return this.conversationRepository.find(query);
  }

  async findByUser(userId: number): Promise<Conversation[]> {
    return this.conversationRepository.find({
      where: { assignedUserId: userId },
      relations: ['customer', 'assignedUser'],
      order: { lastMessageAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({
      where: { id },
      relations: ['customer', 'assignedUser', 'messages'],
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${id} not found`);
    }

    return conversation;
  }

  async assignToUser(conversationId: number, userId: number): Promise<Conversation> {
    const conversation = await this.findOne(conversationId);
    
    await this.conversationRepository.update(conversationId, {
      assignedUserId: userId,
    });
    
    return this.findOne(conversationId);
  }

  async updateStatus(conversationId: number, status: ConversationStatus): Promise<Conversation> {
    const conversation = await this.findOne(conversationId);
    
    await this.conversationRepository.update(conversationId, { status });
    
    return this.findOne(conversationId);
  }

  async create(customerId: number): Promise<Conversation> {
    const conversation = this.conversationRepository.create({
      customerId,
      status: ConversationStatus.OPEN,
      lastMessageAt: new Date(),
    });
    
    return this.conversationRepository.save(conversation);
  }
}