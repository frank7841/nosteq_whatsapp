import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';
import { Conversation } from '../../conversations/entities/conversation.entity';
import { Message } from '../../messages/entities/message.entity';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'phone_number', length: 20, unique: true })
  @Index('idx_phone')
  phoneNumber: string;

  @Column({ name: 'name', length: 255, nullable: true })
  name: string;

  @Column({ name: 'profile_pic_url', type: 'text', nullable: true })
  profilePicUrl: string;

  @Column({ name: 'last_message_at', type: 'timestamp', nullable: true })
  @Index('idx_last_message')
  lastMessageAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Conversation, (conversation) => conversation.customer)
  conversations: Conversation[];

  @OneToMany(() => Message, (message) => message.customer)
  messages: Message[];
}