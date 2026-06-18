import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common'
import { SQLiteService } from '../storage/sqlite.service'
import { ExtensionMessageService } from '../ws/extension-message.service'

export interface Participant {
  id: string
  participantId: string
  name: string
  provider: string
  model: string
  status: ParticipantStatus
  tabId?: number
  connectionId?: string
  capabilities?: string[]
  metadata?: Record<string, unknown>
  lastActive?: number
  createdAt: number
}

export enum ParticipantStatus {
  ONLINE = 'online',
  AWAY = 'away',
  BUSY = 'busy',
  OFFLINE = 'offline'
}

export interface SendPromptParams {
  task: string
  context?: Record<string, unknown>
  timeoutMs?: number
}

export interface PromptResponse {
  text: string
  parsed?: unknown
  duration: number
}

@Injectable()
export class ParticipantService {
  private readonly logger = new Logger(ParticipantService.name)
  private extensionMessageService: ExtensionMessageService | null = null

  constructor(
    private readonly sqliteService: SQLiteService,
    @Inject(forwardRef(() => ExtensionMessageService))
    private readonly extensionMessageServiceRef: any
  ) {
    // 延迟初始化避免循环依赖
    setTimeout(() => {
      this.extensionMessageService = this.extensionMessageServiceRef
    }, 0)
  }

  /**
   * 创建参与者
   */
  async createParticipant(params: {
    participantId: string
    name: string
    provider: string
    model: string
    tabId?: number
    connectionId?: string
  }): Promise<Participant> {
    const participant: Participant = {
      id: '',  // 临时值，会被数据库 ID 替换
      participantId: params.participantId,
      name: params.name,
      provider: params.provider,
      model: params.model,
      status: ParticipantStatus.ONLINE,
      tabId: params.tabId,
      connectionId: params.connectionId,
      createdAt: Date.now(),
      lastActive: Date.now()
    }

    const stmt = this.sqliteService.prepare(`
      INSERT INTO participants (
        participant_id, name, provider, model, status,
        tab_id, connection_id, capabilities, metadata, last_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const result = stmt.run(
      participant.participantId,
      participant.name,
      participant.provider,
      participant.model,
      participant.status,
      participant.tabId || null,
      participant.connectionId || null,
      JSON.stringify(participant.capabilities || []),
      JSON.stringify(participant.metadata || {}),
      participant.lastActive,
      participant.createdAt
    )

    participant.id = String(result.lastInsertRowid)

    this.logger.log(`Participant created: ${participant.participantId}`)

    return participant
  }

  /**
   * 获取参与者
   */
  getParticipant(idOrParticipantId: string): Participant | undefined {
    const isId = !isNaN(Number(idOrParticipantId)) && idOrParticipantId.length < 10
    const query = isId
      ? 'SELECT * FROM participants WHERE id = ?'
      : 'SELECT * FROM participants WHERE participant_id = ?'

    const stmt = this.sqliteService.prepare(query)
    const row = stmt.get(isId ? Number(idOrParticipantId) : idOrParticipantId) as Record<string, unknown> | undefined

    if (row) {
      return this.rowToParticipant(row)
    }

    return undefined
  }

  /**
   * 按 provider 获取参与者
   */
  getParticipantsByProvider(provider: string): Participant[] {
    const stmt = this.sqliteService.prepare(`
      SELECT * FROM participants WHERE provider = ? ORDER BY last_active DESC
    `)

    const rows = stmt.all(provider) as Record<string, unknown>[]

    return rows.map(row => this.rowToParticipant(row))
  }

  /**
   * 按 roomId 获取参与者
   */
  getParticipantsByRoom(roomId: string): Participant[] {
    // 这个查询需要关联 room_participants 表
    const stmt = this.sqliteService.prepare(`
      SELECT p.* FROM participants p
      INNER JOIN room_participants rp ON p.id = rp.participant_id
      WHERE rp.room_id = ?
    `)

    const rows = stmt.all(roomId) as Record<string, unknown>[]

    return rows.map(row => this.rowToParticipant(row))
  }

  /**
   * 获取所有参与者
   */
  getAllParticipants(): Participant[] {
    const stmt = this.sqliteService.prepare(`
      SELECT * FROM participants ORDER BY last_active DESC
    `)

    const rows = stmt.all() as Record<string, unknown>[]

    return rows.map(row => this.rowToParticipant(row))
  }

  /**
   * 获取在线参与者
   */
  getOnlineParticipants(): Participant[] {
    const stmt = this.sqliteService.prepare(`
      SELECT * FROM participants WHERE status = ? ORDER BY last_active DESC
    `)

    const rows = stmt.all(ParticipantStatus.ONLINE) as Record<string, unknown>[]

    return rows.map(row => this.rowToParticipant(row))
  }

  /**
   * 更新参与者状态
   */
  updateParticipantStatus(
    idOrParticipantId: string,
    status: ParticipantStatus
  ): Participant | undefined {
    const existing = this.getParticipant(idOrParticipantId)

    if (!existing) {
      return undefined
    }

    const stmt = this.sqliteService.prepare(`
      UPDATE participants SET status = ?, last_active = ? WHERE id = ?
    `)

    stmt.run(status, Date.now(), existing.id)

    return {
      ...existing,
      status,
      lastActive: Date.now()
    }
  }

  /**
   * 更新最后活跃时间
   */
  touchParticipant(idOrParticipantId: string): void {
    const existing = this.getParticipant(idOrParticipantId)

    if (existing) {
      const stmt = this.sqliteService.prepare(`
        UPDATE participants SET last_active = ? WHERE id = ?
      `)

      stmt.run(Date.now(), existing.id)
    }
  }

  /**
   * 删除参与者
   */
  deleteParticipant(idOrParticipantId: string): boolean {
    const existing = this.getParticipant(idOrParticipantId)

    if (!existing) {
      return false
    }

    const stmt = this.sqliteService.prepare('DELETE FROM participants WHERE id = ?')
    const result = stmt.run(existing.id)

    return result.changes > 0
  }

  /**
   * 发送提示词给参与者
   */
  async sendPrompt(
    idOrParticipantId: string,
    params: SendPromptParams
  ): Promise<PromptResponse> {
    const participant = this.getParticipant(idOrParticipantId)

    if (!participant) {
      throw new Error('Participant not found')
    }

    if (!this.extensionMessageService) {
      throw new Error('ExtensionMessageService not available')
    }

    const correlationId = `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const startTime = Date.now()

    try {
      const response = await this.extensionMessageService.sendPrompt({
        participantId: participant.participantId,
        correlationId,
        task: params.task,
        context: params.context,
        timeoutMs: params.timeoutMs
      })

      return {
        text: response.text,
        parsed: response.parsed,
        duration: Date.now() - startTime
      }
    } catch (error) {
      this.logger.error(`Prompt failed: ${error}`)
      throw error
    }
  }

  /**
   * 转换数据库行为参与者
   */
  private rowToParticipant(row: Record<string, unknown>): Participant {
    return {
      id: String(row.id),
      participantId: row.participant_id as string,
      name: row.name as string,
      provider: row.provider as string,
      model: row.model as string,
      status: row.status as ParticipantStatus,
      tabId: row.tab_id as number | undefined,
      connectionId: row.connection_id as string | undefined,
      capabilities: JSON.parse((row.capabilities as string) || '[]'),
      metadata: JSON.parse((row.metadata as string) || '{}'),
      lastActive: row.last_active as number | undefined,
      createdAt: row.created_at as number
    }
  }
}
