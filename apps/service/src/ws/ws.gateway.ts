import { Injectable, Logger } from '@nestjs/common'

/**
 * WebSocket 网关服务
 * 注：实际的 WebSocket 服务器在 main.ts 中初始化
 * 这里只提供消息发送功能
 */
@Injectable()
export class WsGateway {
  private readonly logger = new Logger(WsGateway.name)

  constructor() {
    this.logger.log('WsGateway initialized')
  }

  /**
   * 处理 WebSocket 消息
   */
  handleMessage(clientId: string, message: any): void {
    this.logger.debug(`Message from ${clientId}:`, message)
  }
}
