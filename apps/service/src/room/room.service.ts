import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { RoomState, Room, RoomStatus, DEFAULT_ROOM_ID } from './room.state'
import { SQLiteService } from '../storage/sqlite.service'
import { IssueLedgerService } from '../issues/issue-ledger.service'
import { DecisionRecordService } from '../decision/decision-record.service'
import { ConsensusService } from '../consensus/consensus.service'

export { RoomStatus, RoomState }

export interface CreateRoomParams {
  name: string
  description?: string
  createdBy: string
}

@Injectable()
export class RoomService implements OnModuleInit {
  private readonly logger = new Logger(RoomService.name)

  constructor(
    private readonly roomState: RoomState,
    private readonly sqliteService: SQLiteService,
    private readonly issueLedgerService: IssueLedgerService,
    private readonly decisionService: DecisionRecordService,
    private readonly consensusService: ConsensusService
  ) {}

  /**
   * 模块初始化时确保默认房间存在
   */
  onModuleInit() {
    this.initializeDefaultRoom()
  }

  /**
   * 初始化默认房间到数据库
   */
  private initializeDefaultRoom(): void {
    try {
      // 检查数据库中是否已存在默认房间
      const stmt = this.sqliteService.prepare('SELECT id FROM rooms WHERE id = ?')
      const existing = stmt.get(DEFAULT_ROOM_ID)

      if (!existing) {
        // 写入默认房间到数据库
        const insertStmt = this.sqliteService.prepare(`
          INSERT INTO rooms (id, name, description, status, created_by, participants, issues, metadata, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        const now = Date.now()
        insertStmt.run(
          DEFAULT_ROOM_ID,
          'Default Room',
          'AI Council 默认房间',
          'active',
          'system',
          '[]',
          '[]',
          '{}',
          now,
          now
        )
        this.logger.log(`Default room initialized in database: ${DEFAULT_ROOM_ID}`)
      }
    } catch (error) {
      this.logger.warn('Failed to initialize default room:', error)
    }
  }

  /**
   * 创建房间
   */
  async createRoom(params: CreateRoomParams): Promise<Room> {
    const roomId = this.generateRoomId()
    const room: Room = {
      id: roomId,
      name: params.name,
      description: params.description,
      status: RoomStatus.ACTIVE,
      createdBy: params.createdBy,
      participants: [],
      issues: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    // 写入数据库
    const stmt = this.sqliteService.prepare(`
      INSERT INTO rooms (id, name, description, status, created_by, participants, issues, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      room.id,
      room.name,
      room.description || null,
      room.status,
      room.createdBy,
      JSON.stringify(room.participants),
      JSON.stringify(room.issues),
      JSON.stringify(room.metadata || {}),
      room.createdAt,
      room.updatedAt
    )

    // 写入内存
    this.roomState.setRoom(room.id, room)

    this.logger.log(`Room created: ${room.id}`)

    return room
  }

  /**
   * 获取房间
   */
  getRoom(roomId: string): Room | undefined {
    return this.roomState.getRoom(roomId)
  }

  /**
   * 获取所有房间
   */
  getAllRooms(): Room[] {
    return this.roomState.getAllRooms()
  }

  /**
   * 更新房间
   */
  updateRoom(
    roomId: string,
    updates: Partial<Omit<Room, 'id' | 'createdBy' | 'createdAt'>>
  ): Room | undefined {
    const room = this.roomState.getRoom(roomId)

    if (!room) {
      return undefined
    }

    const updated: Room = {
      ...room,
      ...updates,
      updatedAt: Date.now()
    }

    this.roomState.setRoom(roomId, updated)

    return updated
  }

  /**
   * 添加参与者到房间
   */
  addParticipant(roomId: string, participantId: string): Room | undefined {
    const room = this.roomState.getRoom(roomId)

    if (!room) {
      return undefined
    }

    if (!room.participants.includes(participantId)) {
      room.participants.push(participantId)
      room.updatedAt = Date.now()
      this.roomState.setRoom(roomId, room)
    }

    return room
  }

  /**
   * 移除参与者
   */
  removeParticipant(roomId: string, participantId: string): Room | undefined {
    const room = this.roomState.getRoom(roomId)

    if (!room) {
      return undefined
    }

    room.participants = room.participants.filter(id => id !== participantId)
    room.updatedAt = Date.now()
    this.roomState.setRoom(roomId, room)

    return room
  }

  /**
   * 添加问题到房间
   */
  addIssue(roomId: string, issueId: string): Room | undefined {
    const room = this.roomState.getRoom(roomId)

    if (!room) {
      return undefined
    }

    if (!room.issues.includes(issueId)) {
      room.issues.push(issueId)
      room.updatedAt = Date.now()
      this.roomState.setRoom(roomId, room)
    }

    return room
  }

  /**
   * 获取房间统计
   */
  getRoomStats(roomId: string): {
    participants: number
    issues: number
    resolvedIssues: number
  } {
    const room = this.roomState.getRoom(roomId)

    if (!room) {
      return { participants: 0, issues: 0, resolvedIssues: 0 }
    }

    const issueStats = this.issueLedgerService.getStatistics(roomId)

    return {
      participants: room.participants.length,
      issues: issueStats.total,
      resolvedIssues: issueStats.resolved + issueStats.closed
    }
  }

  /**
   * 关闭房间
   */
  closeRoom(roomId: string): Room | undefined {
    return this.updateRoom(roomId, { status: RoomStatus.CLOSED })
  }

  /**
   * 生成房间 ID
   */
  private generateRoomId(): string {
    return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}
