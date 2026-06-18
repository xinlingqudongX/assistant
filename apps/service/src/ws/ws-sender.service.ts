import { Injectable, Logger } from '@nestjs/common'

/**
 * WebSocket 消息发送服务
 * 独立出来避免循环依赖
 */
@Injectable()
export class WsSenderService {
  private readonly logger = new Logger(WsSenderService.name)

  // 存储 gateway 的引用
  private gateway: any = null

  /**
   * 注册 gateway 引用
   */
  registerGateway(gateway: any): void {
    this.gateway = gateway
  }

  /**
   * 发送消息到客户端
   */
  sendToClient(clientId: string, event: string, data: any): void {
    if (!this.gateway) {
      this.logger.warn('Gateway not registered')
      return
    }

    try {
      const socket = this.gateway.server?.sockets?.sockets?.get(clientId)
      if (socket) {
        socket.emit(event, data)
        this.logger.debug(`Message sent to ${clientId}: ${event}`)
      } else {
        this.logger.warn(`Client not found: ${clientId}`)
      }
    } catch (error) {
      this.logger.error(`Failed to send message: ${error}`)
    }
  }

  /**
   * 广播消息到所有客户端
   */
  broadcast(event: string, data: any): void {
    if (!this.gateway) {
      this.logger.warn('Gateway not registered')
      return
    }

    try {
      this.gateway.server?.emit(event, data)
      this.logger.debug(`Broadcast sent: ${event}`)
    } catch (error) {
      this.logger.error(`Failed to broadcast: ${error}`)
    }
  }

  /**
   * 发送消息到指定房间
   */
  sendToRoom(room: string, event: string, data: any): void {
    if (!this.gateway) {
      this.logger.warn('Gateway not registered')
      return
    }

    try {
      this.gateway.server?.to(room).emit(event, data)
      this.logger.debug(`Room message sent to ${room}: ${event}`)
    } catch (error) {
      this.logger.error(`Failed to send room message: ${error}`)
    }
  }
}
