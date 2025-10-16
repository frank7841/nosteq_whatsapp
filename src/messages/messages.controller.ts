import { 
    Controller, 
    Get, 
    Post, 
    Body, 
    Param, 
    UseGuards, 
    Request,
    HttpCode,
    HttpStatus,
    BadRequestException,
    Query
  } from '@nestjs/common';
  import { MessagesService } from './messages.service';
  import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
  
  class SendMessageDto {
    conversationId: number;
    customerId: number;
    content: string;
    phoneNumber: string;
  }
  
  class SendMediaDto {
    conversationId: number;
    customerId: number;
    phoneNumber: string;
    mediaType: 'image' | 'video' | 'document' | 'audio';
    mediaUrl: string;
    caption?: string;
  }

  class MarkConversationReadDto {
    conversationId: number;
    userId?: number;
  }
  
  @Controller('messages')
  @UseGuards(JwtAuthGuard)
  export class MessagesController {
    constructor(private readonly messagesService: MessagesService) {}
  
    @Get('conversation/:conversationId')
    @HttpCode(HttpStatus.OK)
    async findByConversation(@Param('conversationId') conversationId: string) {
      return this.messagesService.findByConversation(+conversationId);
    }
  
    @Post('send')
    @HttpCode(HttpStatus.CREATED)
    async sendMessage(@Body() body: SendMessageDto, @Request() req) {

      console.log(' Received send message request:', body);
    
      const { conversationId, customerId, content, phoneNumber } = body;
      
      if (!conversationId || !customerId || !content || !phoneNumber) {
        throw new BadRequestException({
          message: 'Missing required fields',
          required: ['conversationId', 'customerId', 'content', 'phoneNumber'],
          received: body,
        });
      }
  
      return this.messagesService.sendMessage(
        +conversationId,
        +customerId,
        content,
        req.user.userId,
        phoneNumber,
      );
    }
  
    @Post('send-media')
    @HttpCode(HttpStatus.CREATED)
    async sendMediaMessage(@Body() body: SendMediaDto, @Request() req) {
      if (!body.mediaUrl || !body.conversationId || !body.customerId || !body.phoneNumber) {
        throw new BadRequestException('Missing required fields');
      }
  
      return this.messagesService.sendMediaMessage(
        body.conversationId,
        body.customerId,
        body.phoneNumber,
        body.mediaType,
        body.mediaUrl,
        req.user.userId,
        body.caption,
      );
    }
  
    @Get('stats')
    @HttpCode(HttpStatus.OK)
    async getMessageStats(@Request() req) {
      return this.messagesService.getMessageStats(req.user.userId);
    }
  
    @Post(':messageId/read')
    @HttpCode(HttpStatus.OK)
    async markAsRead(@Param('messageId') messageId: string) {
      return this.messagesService.markAsRead(+messageId);
    }

    @Post('conversation/:conversationId/read')
    @HttpCode(HttpStatus.OK)
    async markConversationAsRead(
      @Param('conversationId') conversationId: string,
      @Request() req,
      @Body() body?: { userId?: number }
    ) {
      const userId = body?.userId || req.user.userId;
      await this.messagesService.markConversationAsRead(+conversationId, userId);
      return { success: true, message: 'Conversation marked as read' };
    }

    @Get('unread/count')
    @HttpCode(HttpStatus.OK)
    async getUnreadCount(
      @Request() req,
      @Query('conversationId') conversationId?: string
    ) {
      const count = await this.messagesService.getUnreadCount(
        conversationId ? +conversationId : undefined,
        req.user.userId
      );
      return { count };
    }

    @Get('unread')
    @HttpCode(HttpStatus.OK)
    async getUnreadMessages(
      @Request() req,
      @Query('conversationId') conversationId?: string
    ) {
      return this.messagesService.getUnreadMessages(
        conversationId ? +conversationId : undefined,
        req.user.userId
      );
    }

    @Get('debug/unread-diagnostics')
    @HttpCode(HttpStatus.OK)
    async getUnreadDiagnostics(@Request() req) {
      return this.messagesService.getUnreadDiagnostics(req.user.userId);
    }
  }
  