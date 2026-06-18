import { Injectable, Logger } from '@nestjs/common'
import { ParticipantService, ParticipantStatus } from '../participants/participant.service'
import { ConsensusService } from '../consensus/consensus.service'
import { RoomService } from '../room/room.service'
import { IssueLedgerService } from '../issues/issue-ledger.service'
import { ExtensionMessageService } from './extension-message.service'
import { DEFAULT_ROOM_ID } from '../room/room.state'

interface ClientInfo {
  clientId: string
  userId: string
  capabilities: string[]
  connectedAt: number
}

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
  timeout: NodeJS.Timeout
}

@Injectable()
export class WsMessageRouterService {
  private readonly logger = new Logger(WsMessageRouterService.name)

  // 客户端连接信息
  private clients: Map<string, ClientInfo> = new Map()

  // 待处理的请求
  private pendingRequests: Map<string, PendingRequest> = new Map()

  // 客户端到 participantId 的映射
  private clientToParticipant: Map<string, string> = new Map()
  private participantToClient: Map<string, string> = new Map()

  constructor(
    private readonly participantService: ParticipantService,
    private readonly consensusService: ConsensusService,
    private readonly roomService: RoomService,
    private readonly issueLedgerService: IssueLedgerService,
    private readonly extensionMessageService: ExtensionMessageService
  ) {}

  /**
   * 注册连接
   */
  registerConnection(clientId: string, info: { clientId: string; userId: string; connectedAt?: number }): void {
    this.clients.set(clientId, {
      ...info,
      capabilities: [],
      connectedAt: info.connectedAt || Date.now()
    })
  }

  /**
   * 注销连接
   */
  unregisterConnection(clientId: string): void {
    const info = this.clients.get(clientId)
    if (info) {
      // 清理 participant 映射
      const participantId = this.clientToParticipant.get(clientId)
      if (participantId) {
        // 同步注销扩展消息连接映射，并标记参与者离线
        this.extensionMessageService.unregisterParticipantConnection(participantId)
        try {
          this.participantService.updateParticipantStatus(participantId, ParticipantStatus.OFFLINE)
        } catch (error) {
          this.logger.warn(`Failed to set participant ${participantId} offline: ${error}`)
        }
        this.participantToClient.delete(participantId)
        this.clientToParticipant.delete(clientId)
      }

      this.clients.delete(clientId)
    }
  }

  /**
   * 更新客户端能力
   */
  updateClientCapabilities(clientId: string, capabilities: string[]): void {
    const info = this.clients.get(clientId)
    if (info) {
      info.capabilities = capabilities
    }
  }

  /**
   * 处理 tab 注册
   * 已授权的 AI 连接后自动加入默认房间
   */
  async handleTabRegister(
    clientId: string,
    data: { participantId: string; provider: string; tabId: number; url: string }
  ): Promise<{ success: boolean; participantId: string }> {
    try {
      // 创建或更新参与者
      let participant = await this.participantService.getParticipant(data.participantId)

      if (!participant) {
        participant = await this.participantService.createParticipant({
          participantId: data.participantId,
          name: `${data.provider}-${data.tabId}`,
          provider: data.provider,
          model: 'default',
          tabId: data.tabId,
          connectionId: clientId
        })
      } else {
        // 已存在则更新为在线，刷新连接与 tab 信息
        this.participantService.updateParticipantStatus(data.participantId, ParticipantStatus.ONLINE)
      }

      // 建立映射
      this.clientToParticipant.set(clientId, data.participantId)
      this.participantToClient.set(data.participantId, clientId)

      // 桥接到扩展消息服务，使 sendPrompt 能找到该 participant
      this.extensionMessageService.registerParticipantConnection(data.participantId, clientId)

      // 自动加入默认房间
      try {
        const room = this.roomService.addParticipant(DEFAULT_ROOM_ID, data.participantId)
        if (room) {
          // 回发 room.joined 通知客户端
          this.extensionMessageService.sendToParticipant(data.participantId, 'room.joined', {
            roomId: DEFAULT_ROOM_ID,
            participantId: data.participantId
          })
        }
      } catch (error) {
        this.logger.warn(`Failed to join default room for ${data.participantId}: ${error}`)
      }

      this.logger.log(`Tab registered: ${data.participantId} (joined ${DEFAULT_ROOM_ID})`)

      return {
        success: true,
        participantId: data.participantId
      }
    } catch (error) {
      this.logger.error(`Tab register failed: ${error}`)
      return {
        success: false,
        participantId: data.participantId
      }
    }
  }

  /**
   * 处理 tab 状态更新
   */
  handleTabStatus(
    clientId: string,
    data: { participantId: string; status: string }
  ): { success: boolean } {
    const participant = this.participantService.getParticipant(data.participantId)

    if (participant) {
      this.participantService.updateParticipantStatus(
        data.participantId,
        data.status as any
      )

      // 离线时注销扩展连接映射，避免向已断开的 participant 发送 prompt
      if (data.status === ParticipantStatus.OFFLINE) {
        this.extensionMessageService.unregisterParticipantConnection(data.participantId)
      } else {
        // 在线/其它在线态则确保连接映射存在
        const mapped = this.participantToClient.get(data.participantId)
        if (mapped) {
          this.extensionMessageService.registerParticipantConnection(data.participantId, mapped)
        }
      }
    }

    return { success: true }
  }

  /**
   * 处理 prompt 执行
   */
  async handlePromptExecute(
    clientId: string,
    data: { correlationId: string; participantId: string; task: string }
  ): Promise<{ success: boolean; correlationId: string }> {
    try {
      // 找到对应的 tab 连接
      const targetClientId = this.participantToClient.get(data.participantId)

      if (targetClientId) {
        // 发送消息给目标客户端
        // 这需要在 ws.gateway 中处理
        return { success: true, correlationId: data.correlationId }
      }

      return { success: false, correlationId: data.correlationId }
    } catch (error) {
      this.logger.error(`Prompt execute failed: ${error}`)
      return { success: false, correlationId: data.correlationId }
    }
  }

  /**
   * 处理响应完成
   */
  async handleResponseDone(
    clientId: string,
    data: { correlationId: string; participantId: string; text: string }
  ): Promise<{ success: boolean }> {
    // 查找并解析待处理的请求
    const pending = this.pendingRequests.get(data.correlationId)

    if (pending) {
      clearTimeout(pending.timeout)
      pending.resolve({
        text: data.text
      })
      this.pendingRequests.delete(data.correlationId)
    }

    return { success: true }
  }

  /**
   * 处理响应错误
   */
  async handleResponseError(
    clientId: string,
    data: { correlationId: string; participantId: string; error: string }
  ): Promise<{ success: boolean }> {
    const pending = this.pendingRequests.get(data.correlationId)

    if (pending) {
      clearTimeout(pending.timeout)
      pending.reject(new Error(data.error))
      this.pendingRequests.delete(data.correlationId)
    }

    return { success: true }
  }

  /**
   * 处理房间创建
   */
  async handleRoomCreate(
    clientId: string,
    data: { name: string; description?: string }
  ): Promise<{ success: boolean; room?: unknown }> {
    try {
      const clientInfo = this.clients.get(clientId)

      const room = await this.roomService.createRoom({
        name: data.name,
        description: data.description,
        createdBy: clientInfo?.userId || 'unknown'
      })

      return { success: true, room }
    } catch (error) {
      this.logger.error(`Room create failed: ${error}`)
      return { success: false }
    }
  }

  /**
   * 处理加入房间
   */
  handleRoomJoin(
    clientId: string,
    data: { roomId: string }
  ): { success: boolean } {
    // 在 ws.gateway 中加入 socket 房间
    return { success: true }
  }

  /**
   * 处理离开房间
   */
  handleRoomLeave(
    clientId: string,
    data: { roomId: string }
  ): { success: boolean } {
    return { success: true }
  }

  /**
   * 获取客户端信息
   */
  getClientInfo(clientId: string): ClientInfo | undefined {
    return this.clients.get(clientId)
  }

  /**
   * 获取所有在线客户端
   */
  getOnlineClients(): ClientInfo[] {
    return Array.from(this.clients.values())
  }
}
