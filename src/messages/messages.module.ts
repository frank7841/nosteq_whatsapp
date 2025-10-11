import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { Message } from './entities/message.entity';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [TypeOrmModule.forFeature([Message]), WhatsAppModule, ConversationsModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}