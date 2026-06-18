import { Injectable } from '@nestjs/common'

export enum RoomStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  CLOSED = 'closed'
}

export const DEFAULT_ROOM_ID = 'default_room'

export interface Room {
  id: string
  name: string
  description?: string
  status: RoomStatus
  createdBy: string
  participants: string[]
  issues: string[]
  metadata?: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

@Injectable()
export class RoomState {
  private rooms: Map<string, Room> = new Map()

  /**
   * 设置房间
   */
  setRoom(roomId: string, room: Room): void {
    this.rooms.set(roomId, room)
  }

  /**
   * 获取房间
   */
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId)
  }

  /**
   * 删除房间
   */
  deleteRoom(roomId: string): boolean {
    return this.rooms.delete(roomId)
  }

  /**
   * 获取所有房间
   */
  getAllRooms(): Room[] {
    return Array.from(this.rooms.values())
  }

  /**
   * 获取房间数量
   */
  get size(): number {
    return this.rooms.size
  }

  /**
   * 清空所有房间
   */
  clear(): void {
    this.rooms.clear()
  }
}
