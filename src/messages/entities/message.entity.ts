import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Conversation } from '../../conversations/entities/conversation.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { User } from '../../users/entities/user.entity';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document',
  AUDIO = 'audio',
  TEMPLATE = 'template',
}

export enum MessageDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'conversation_id' })
  @Index('idx_conversation')
  conversationId: number;

  @Column({ name: 'customer_id' })
  @Index('idx_customer')
  customerId: number;

  @Column({ name: 'user_id', nullable: true })
  @Index('idx_user')
  userId: number;

  @Column({
    name:'message_type',
    type: 'enum',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  messageType: MessageType;

  @Column({
    type: 'enum',
    enum: MessageDirection,
  })
  @Index('idx_direction')
  direction: MessageDirection;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'media_url', type: 'text', nullable: true })
  mediaUrl: string;

  @Column({ name: 'whatsapp_message_id', length: 255, nullable: true })
  @Index('idx_whatsapp_id')
  whatsappMessageId: string;

  @Column({
    type: 'enum',
    enum: MessageStatus,
    default: MessageStatus.SENT,
  })
  status: MessageStatus;

  @Column({ type: 'json', nullable: true })
  metadata: any;

  @CreateDateColumn({ name: 'created_at' })
  @Index('idx_created_at')
  createdAt: Date;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages)
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @ManyToOne(() => Customer, (customer) => customer.messages)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => User, (user) => user.messages)
  @JoinColumn({ name: 'user_id' })
  user: User;
}