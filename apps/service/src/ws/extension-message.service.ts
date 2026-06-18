import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common'
import { WsSenderService } from './ws-sender.service'

export interface PromptRequest {
  participantId: string
  correlationId: string
  task: string
  context?: Record<string, unknown>
  timeoutMs?: number
}

export interface PromptResponse {
  text: string
  parsed?: unknown
}

interface PendingPrompt {
  resolve: (value: PromptResponse) => void
  reject: (reason: Error) => void
  timeout: NodeJS.Timeout
}

@Injectable()
export class ExtensionMessageService {
  private readonly logger = new Logger(ExtensionMessageService.name)

  // 参与者连接映射
  private participantConnections: Map<string, string> = new Map()

  // 待处理的 prompt 请求
  private pendingPrompts: Map<string, PendingPrompt> = new Map()

  constructor(private readonly wsSender: WsSenderService) {}

  /**
   * 注册参与者连接
   */
  registerParticipantConnection(participantId: string, clientId: string): void {
    this.participantConnections.set(participantId, clientId)
  }

  /**
   * 注销参与者连接
   */
  unregisterParticipantConnection(participantId: string): void {
    this.participantConnections.delete(participantId)
  }

  /**
   * 发送 prompt 并等待响应
   */
  async sendPrompt(request: PromptRequest): Promise<PromptResponse> {
    const { participantId, correlationId, task, context, timeoutMs = 30000 } = request

    // 获取参与者连接
    const clientId = this.participantConnections.get(participantId)

    if (!clientId) {
      throw new Error(`Participant ${participantId} is not connected`)
    }

    // 创建 Promise
    const response = new Promise<PromptResponse>((resolve, reject) => {
      // 设置超时
      const timeout = setTimeout(() => {
        this.pendingPrompts.delete(correlationId)
        reject(new Error('Prompt timeout'))
      }, timeoutMs)

      // 存储待处理请求
      this.pendingPrompts.set(correlationId, {
        resolve,
        reject,
        timeout
      })
    })

    // 发送消息到扩展
    this.wsSender.sendToClient(clientId, 'ai.prompt.execute', {
      type: 'ai.prompt.execute',
      correlationId,
      participantId,
      task,
      context
    })

    this.logger.log(`Prompt sent to ${participantId}: ${correlationId}`)

    return response
  }

  /**
   * 处理响应
   */
  handleResponse(correlationId: string, data: { text: string; parsed?: unknown }): void {
    const pending = this.pendingPrompts.get(correlationId)

    if (pending) {
      clearTimeout(pending.timeout)
      pending.resolve({
        text: data.text,
        parsed: data.parsed
      })
      this.pendingPrompts.delete(correlationId)

      this.logger.log(`Prompt resolved: ${correlationId}`)
    } else {
      this.logger.warn(`Unknown correlation ID: ${correlationId}`)
    }
  }

  /**
   * 处理错误
   */
  handleError(correlationId: string, error: string): void {
    const pending = this.pendingPrompts.get(correlationId)

    if (pending) {
      clearTimeout(pending.timeout)
      pending.reject(new Error(error))
      this.pendingPrompts.delete(correlationId)

      this.logger.error(`Prompt error: ${correlationId} - ${error}`)
    }
  }
}
