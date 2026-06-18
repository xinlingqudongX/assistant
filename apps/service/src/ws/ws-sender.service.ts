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
  sendToClient(clientId: string, event: string, data: any): boolean {
    if (!this.gateway) {
      this.logger.warn('Gateway not registered')
      return false
    }

    const message = { type: event, ...data }
    return this.gateway.sendToClient(clientId, message)
  }

  /**
   * 广播消息到所有客户端
   */
  broadcast(event: string, data: any): void {
    if (!this.gateway) {
      this.logger.warn('Gateway not registered')
      return
    }

    this.gateway.broadcast(event, data)
  }

  /**
   * 发送消息到指定房间
   * 注：原生 WebSocket 需要自己管理房间
   */
  sendToRoom(room: string, event: string, data: any): void {
    // 原生 WebSocket 没有房间概念，这里简化处理
    this.logger.warn(`sendToRoom not fully implemented for native WebSocket`)
    this.broadcast(event, data)
  }
}
