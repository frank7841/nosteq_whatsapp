import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CustomersModule } from './customers/customers.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { User } from './users/entities/user.entity';
import { Customer } from './customers/entities/customer.entity';
import { Conversation } from './conversations/entities/conversation.entity';
import { Message } from './messages/entities/message.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('DB_HOST', 'localhost'),
        port: +(configService.get('DB_PORT', 3306) || 3306),
        username: configService.get('DB_USERNAME', 'root'),
        password: configService.get('DB_PASSWORD', ''),
        database: configService.get('DB_DATABASE', 'whatsapp_gateway'),
        entities: [User, Customer, Conversation, Message],
        synchronize: configService.get('NODE_ENV') === 'development', // Set to false in production
        logging: configService.get('NODE_ENV') === 'development',
        charset: 'utf8mb4',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    CustomersModule,
    ConversationsModule,
    MessagesModule,
    WhatsAppModule,
  ],
})
export class AppModule {}