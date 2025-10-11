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
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true,
  },
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
    this.server.emit('conversation_update', { conversationId, ...update });
  }
}