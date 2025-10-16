import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    // Allow all origins to quickly resolve CORS issues (tighten via env later if needed)
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  },
  transports: ['websocket', 'polling'],
})
export class ConversationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub;
      console.log(`Client connected: ${client.id}, User: ${payload.sub}`);
    } catch (error) {
      console.log('Unauthorized connection');
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_conversation')
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: number },
  ) {
    client.join(`conversation_${data.conversationId}`);
    console.log(`User joined conversation: ${data.conversationId}`);
  }

  @SubscribeMessage('leave_conversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: number },
  ) {
    client.leave(`conversation_${data.conversationId}`);
  }

  emitNewMessage(conversationId: number, message: any) {
    this.server.to(`conversation_${conversationId}`).emit('new_message', message);
  }

  emitNewConversation(conversation: any) {
    this.server.emit('new_conversation', conversation);
  }

  emitConversationUpdate(conversationId: number, update: any) {
    // Emit to specific conversation room AND globally for conversation list updates
    this.server.to(`conversation_${conversationId}`).emit('conversation_update', { conversationId, ...update });
    // Also emit globally for conversation list updates (e.g., status changes in sidebar)
    this.server.emit('conversation_status_change', { conversationId, ...update });
  }

  emitMessageRead(conversationId: number, data: { messageId: number; readAt: Date }) {
    this.server.to(`conversation_${conversationId}`).emit('message_read', data);
  }

  emitConversationRead(conversationId: number, data: { messageIds: number[]; readAt: Date }) {
    this.server.to(`conversation_${conversationId}`).emit('conversation_read', data);
  }

  // Emit unread count updates globally (for notification badges, etc.)
  emitUnreadCountUpdate(userId?: number, data?: { totalUnread: number; conversationId?: number; conversationUnread?: number }) {
    if (userId) {
      // Emit to specific user if userId provided
      this.server.to(`user_${userId}`).emit('unread_count_update', data);
    } else {
      // Emit globally if no specific user
      this.server.emit('unread_count_update', data);
    }
  }

  // Handle user-specific rooms for targeted notifications
  @SubscribeMessage('join_user_room')
  handleJoinUserRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: number },
  ) {
    client.join(`user_${data.userId}`);
    console.log(`User ${data.userId} joined their personal room`);
  }

  // Enhanced message read event with more context
  emitMessageReadWithContext(conversationId: number, data: { 
    messageId: number; 
    readAt: Date; 
    conversationUnreadCount: number;
    totalUnreadCount?: number;
  }) {
    this.server.to(`conversation_${conversationId}`).emit('message_read_detailed', data);
  }
}