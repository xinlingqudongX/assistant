import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { WsMessageRouterService } from './ws-message-router.service'
import { WsAuthService } from './ws-auth.service'
import { WsSenderService } from './ws-sender.service'
import { Logger } from '@nestjs/common'

@WebSocketGateway({
  cors: {
    origin: '*'
  },
  namespace: '/ws'
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  private readonly logger = new Logger(WsGateway.name)

  @WebSocketServer()
  server: Server

  constructor(
    private readonly messageRouter: WsMessageRouterService,
    private readonly authService: WsAuthService,
    private readonly wsSender: WsSenderService
  ) {}

  /**
   * Gateway 初始化后注册 sender
   */
  afterInit() {
    this.wsSender.registerGateway(this)
    this.logger.log('WebSocket Gateway initialized')
  }

  async handleConnection(client: Socket) {
    try {
      // 验证 token
      const token = client.handshake.auth?.token ||
                   client.handshake.headers?.authorization?.replace('Bearer ', '')

      const isValid = await this.authService.validateToken(token)

      if (!isValid) {
        client.emit('error', { message: 'Unauthorized' })
        client.disconnect()
        return
      }

      // 保存连接信息
      this.messageRouter.registerConnection(client.id, {
        clientId: client.id,
        userId: token,
        connectedAt: Date.now()
      })

      this.logger.log(`Client connected: ${client.id}`)
    } catch (error) {
      this.logger.error('Connection error:', error)
      client.disconnect()
    }
  }

  handleDisconnect(client: Socket) {
    this.messageRouter.unregisterConnection(client.id)
    this.logger.log(`Client disconnected: ${client.id}`)
  }

  @SubscribeMessage('extension.hello')
  handleHello(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { version: string; capabilities: string[] }
  ) {
    this.messageRouter.updateClientCapabilities(client.id, data.capabilities || [])

    client.emit('extension.pong', {
      type: 'extension.pong',
      version: '0.1.0',
      timestamp: Date.now()
    })
  }

  @SubscribeMessage('ai.tab.register')
  handleTabRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { participantId: string; provider: string; tabId: number; url: string }
  ) {
    return this.messageRouter.handleTabRegister(client.id, data)
  }

  @SubscribeMessage('ai.tab.status')
  handleTabStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { participantId: string; status: string }
  ) {
    return this.messageRouter.handleTabStatus(client.id, data)
  }

  @SubscribeMessage('ai.prompt.execute')
  handlePromptExecute(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { correlationId: string; participantId: string; task: string }
  ) {
    return this.messageRouter.handlePromptExecute(client.id, data)
  }

  @SubscribeMessage('ai.response.done')
  handleResponseDone(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { correlationId: string; participantId: string; text: string }
  ) {
    return this.messageRouter.handleResponseDone(client.id, data)
  }

  @SubscribeMessage('ai.response.error')
  handleResponseError(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { correlationId: string; participantId: string; error: string }
  ) {
    return this.messageRouter.handleResponseError(client.id, data)
  }

  @SubscribeMessage('room.create')
  handleRoomCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { name: string; description?: string }
  ) {
    return this.messageRouter.handleRoomCreate(client.id, data)
  }

  @SubscribeMessage('room.join')
  handleRoomJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string }
  ) {
    return this.messageRouter.handleRoomJoin(client.id, data)
  }

  @SubscribeMessage('room.leave')
  handleRoomLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string }
  ) {
    return this.messageRouter.handleRoomLeave(client.id, data)
  }

  /**
   * 广播消息到房间
   */
  broadcastToRoom(roomId: string, event: string, data: unknown) {
    this.server.to(`room:${roomId}`).emit(event, data)
  }

  /**
   * 发送消息给客户端
   */
  sendToClient(clientId: string, event: string, data: unknown) {
    this.server.to(clientId).emit(event, data)
  }
}
