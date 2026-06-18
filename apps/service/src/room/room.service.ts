import { Injectable, Logger } from '@nestjs/common'
import { RoomState, Room, RoomStatus } from './room.state'
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
export class RoomService {
  private readonly logger = new Logger(RoomService.name)

  constructor(
    private readonly roomState: RoomState,
    private readonly issueLedgerService: IssueLedgerService,
    private readonly decisionService: DecisionRecordService,
    private readonly consensusService: ConsensusService
  ) {}

  /**
   * 创建房间
   */
  async createRoom(params: CreateRoomParams): Promise<Room> {
    const room: Room = {
      id: this.generateRoomId(),
      name: params.name,
      description: params.description,
      status: RoomStatus.ACTIVE,
      createdBy: params.createdBy,
      participants: [],
      issues: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

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
