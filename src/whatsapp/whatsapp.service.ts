import { Injectable, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../customers/entities/customer.entity';
import { Conversation, ConversationStatus } from '../conversations/entities/conversation.entity';
import { Message, MessageDirection, MessageType } from '../messages/entities/message.entity';
import axios from 'axios';

@Injectable()
export class WhatsAppService {
  private apiUrl: string;
  private apiToken: string;
  private phoneNumberId: string;

  constructor(
    private configService: ConfigService,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
  ) {
    this.apiUrl = this.configService.get<string>('WHATSAPP_API_URL') || 'https://graph.facebook.com/v22.0';
    this.apiToken = this.configService.get<string>('WHATSAPP_API_TOKEN') || '';
    this.phoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID') || '';
  }

  async handleIncomingMessage(webhookData: any) {
    try {
      const entry = webhookData.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      if (!message) {
        return { success: true, message: 'No message to process' };
      }

      const phoneNumber = message.from;
      const messageText = message.text?.body || '';
      const messageType = message.type;

      // Find or create customer
      let customer = await this.customerRepository.findOne({
        where: { phoneNumber },
      });

      if (!customer) {
        customer = this.customerRepository.create({
          phoneNumber,
          name: value.contacts?.[0]?.profile?.name || phoneNumber,
          lastMessageAt: new Date(),
        });
        await this.customerRepository.save(customer);
      } else {
        customer.lastMessageAt = new Date();
        await this.customerRepository.save(customer);
      }

      // Find or create conversation
      let conversation = await this.conversationRepository.findOne({
        where: { customerId: customer.id, status: ConversationStatus.OPEN },
      });

      if (!conversation) {
        conversation = this.conversationRepository.create({
          customerId: customer.id,
          status: ConversationStatus.OPEN,
          lastMessageAt: new Date(),
        });
        await this.conversationRepository.save(conversation);
      } else {
        conversation.lastMessageAt = new Date();
        await this.conversationRepository.save(conversation);
      }

      // Save message
      const newMessage = this.messageRepository.create({
        conversationId: conversation.id,
        customerId: customer.id,
        direction: MessageDirection.INBOUND,
        content: messageText,
        messageType: messageType as MessageType,
        whatsappMessageId: message.id,
        metadata: message,
      });

      await this.messageRepository.save(newMessage);

      return {
        success: true,
        customer,
        conversation,
        message: newMessage,
      };
    } catch (error) {
      console.error('Error handling incoming message:', error);
      throw new HttpException('Failed to process message', 500);
    }
  }

  async sendMessage(phoneNumber: string, content: string, userId?: number) {
    try {
      console.log('WhatsApp API Request:', {
        url: `${this.apiUrl}`,
        data: {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phoneNumber,
          type: 'text',
          text: { 
            preview_url: false,
            body: content 
          },
        },
        headers: {
          Authorization: `Bearer ${this.apiToken?.substring(0, 20)}...`, // Log partial token for security
          'Content-Type': 'application/json',
        },
      });

      const response = await axios.post(
        `${this.apiUrl}`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phoneNumber,
          type: 'text',
          text: { 
            preview_url: false,
            body: content 
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log('WhatsApp API Success Response:', response.data);
      return response.data;
    } catch (error) {
      console.error('WhatsApp API Error Details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: {
            ...error.config?.headers,
            Authorization: error.config?.headers?.Authorization?.substring(0, 20) + '...'
          }
        }
      });

      if (error.response?.data) {
        console.error('WhatsApp API Error Response Body:', JSON.stringify(error.response.data, null, 2));
      }

      throw new HttpException(
        `WhatsApp API Error: ${error.response?.data?.error?.message || error.message}`,
        error.response?.status || 500
      );
    }
  }

  async sendMediaMessage(
    phoneNumber: string,
    mediaType: 'image' | 'video' | 'document' | 'audio',
    mediaUrl: string,
    caption?: string,
    userId?: number,
  ) {
    try {
      console.log('WhatsApp API Request:', {
        url: `${this.apiUrl}/messages`,
        data: {
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: mediaType,
          [mediaType]: { id: await this.uploadMedia(mediaUrl, mediaType) },
        },
        headers: {
          Authorization: `Bearer ${this.apiToken?.substring(0, 20)}...`, // Log partial token for security
          'Content-Type': 'application/json',
        },
      });

      // First, upload the media to WhatsApp if it's a URL
      const mediaId = await this.uploadMedia(mediaUrl, mediaType);

      const messagePayload: any = {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: mediaType,
        [mediaType]: { id: mediaId },
      };

      // Add caption for supported media types
      if (caption && (mediaType === 'image' || mediaType === 'video' || mediaType === 'document')) {
        messagePayload[mediaType].caption = caption;
      }

      const response = await axios.post(
        `${this.apiUrl}/messages`,
        messagePayload,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log('WhatsApp API Success Response:', response.data);
      return response.data;
    } catch (error) {
      console.error('WhatsApp API Error Details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: {
            ...error.config?.headers,
            Authorization: error.config?.headers?.Authorization?.substring(0, 20) + '...'
          }
        }
      });

      if (error.response?.data) {
        console.error('WhatsApp API Error Response Body:', JSON.stringify(error.response.data, null, 2));
      }

      throw new HttpException(
        `WhatsApp API Error: ${error.response?.data?.error?.message || error.message}`,
        error.response?.status || 500
      );
    }
  }

  private async uploadMedia(mediaUrl: string, mediaType: string): Promise<string> {
    try {
      console.log('WhatsApp API Request:', {
        url: `${this.apiUrl}/media`,
        data: {
          media: mediaUrl,
        },
        headers: {
          Authorization: `Bearer ${this.apiToken?.substring(0, 20)}...`, // Log partial token for security
          'Content-Type': this.getContentType(mediaType),
        },
      });

      // Download the media file
      const mediaResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
      const mediaBuffer = Buffer.from(mediaResponse.data);

      // Upload to WhatsApp Media API
      const uploadResponse = await axios.post(
        `${this.apiUrl}/media`,
        mediaBuffer,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': this.getContentType(mediaType),
          },
        },
      );

      console.log('WhatsApp API Success Response:', uploadResponse.data);
      return uploadResponse.data.id;
    } catch (error) {
      console.error('WhatsApp API Error Details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: {
            ...error.config?.headers,
            Authorization: error.config?.headers?.Authorization?.substring(0, 20) + '...'
          }
        }
      });

      if (error.response?.data) {
        console.error('WhatsApp API Error Response Body:', JSON.stringify(error.response.data, null, 2));
      }

      throw new HttpException(
        `WhatsApp API Error: ${error.response?.data?.error?.message || error.message}`,
        error.response?.status || 500
      );
    }
  }

  private getContentType(mediaType: string): string {
    const contentTypes = {
      image: 'image/jpeg',
      video: 'video/mp4',
      audio: 'audio/ogg',
      document: 'application/pdf',
    };
    return contentTypes[mediaType as keyof typeof contentTypes] || 'application/octet-stream';
  }

  async markMessageAsRead(whatsappMessageId: string) {
    try {
      console.log('WhatsApp API Request:', {
        url: `${this.apiUrl}/messages`,
        data: {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: whatsappMessageId,
        },
        headers: {
          Authorization: `Bearer ${this.apiToken?.substring(0, 20)}...`, // Log partial token for security
          'Content-Type': 'application/json',
        },
      });

      const response = await axios.post(
        `${this.apiUrl}/messages`,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: whatsappMessageId,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log('WhatsApp API Success Response:', response.data);
      return response.data;
    } catch (error) {
      console.error('WhatsApp API Error Details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: {
            ...error.config?.headers,
            Authorization: error.config?.headers?.Authorization?.substring(0, 20) + '...'
          }
        }
      });

      if (error.response?.data) {
        console.error('WhatsApp API Error Response Body:', JSON.stringify(error.response.data, null, 2));
      }

      throw new HttpException(
        `WhatsApp API Error: ${error.response?.data?.error?.message || error.message}`,
        error.response?.status || 500
      );
    }
  }
}
