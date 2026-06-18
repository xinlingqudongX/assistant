import { Injectable, Logger } from '@nestjs/common'
import { SQLiteService } from '../storage/sqlite.service'

export interface DecisionRecord {
  id?: number
  issueId: string
  roomId: string
  decision: string
  rationale: string
  participants: string[]
  consensusLevel: number
  metadata?: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

export interface CreateDecisionParams {
  issueId: string
  roomId: string
  decision: string
  rationale?: string
  participants: string[]
  consensusLevel?: number
  metadata?: Record<string, unknown>
}

@Injectable()
export class DecisionRecordService {
  private readonly logger = new Logger(DecisionRecordService.name)

  constructor(private readonly sqliteService: SQLiteService) {}

  /**
   * 创建决策记录
   */
  async createDecision(params: CreateDecisionParams): Promise<DecisionRecord> {
    const record: DecisionRecord = {
      issueId: params.issueId,
      roomId: params.roomId,
      decision: params.decision,
      rationale: params.rationale || '',
      participants: params.participants,
      consensusLevel: params.consensusLevel ?? 0.5,
      metadata: params.metadata,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    const stmt = this.sqliteService.prepare(`
      INSERT INTO decisions (
        issue_id, room_id, decision, rationale,
        participants, consensus_level, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const result = stmt.run(
      record.issueId,
      record.roomId,
      record.decision,
      record.rationale,
      JSON.stringify(record.participants),
      record.consensusLevel,
      JSON.stringify(record.metadata || {}),
      record.createdAt,
      record.updatedAt
    )

    record.id = Number(result.lastInsertRowid)

    this.logger.log(`Decision created: ${record.id}`)

    return record
  }

  /**
   * 获取决策记录
   */
  getDecision(id: number): DecisionRecord | undefined {
    const stmt = this.sqliteService.prepare(`
      SELECT * FROM decisions WHERE id = ?
    `)

    const row = stmt.get(id) as Record<string, unknown> | undefined

    if (row) {
      return this.rowToRecord(row)
    }

    return undefined
  }

  /**
   * 按 issueId 获取决策
   */
  getDecisionByIssueId(issueId: string): DecisionRecord | undefined {
    const stmt = this.sqliteService.prepare(`
      SELECT * FROM decisions WHERE issue_id = ? ORDER BY created_at DESC LIMIT 1
    `)

    const row = stmt.get(issueId) as Record<string, unknown> | undefined

    if (row) {
      return this.rowToRecord(row)
    }

    return undefined
  }

  /**
   * 按 roomId 获取所有决策
   */
  getDecisionsByRoomId(roomId: string): DecisionRecord[] {
    const stmt = this.sqliteService.prepare(`
      SELECT * FROM decisions WHERE room_id = ? ORDER BY created_at DESC
    `)

    const rows = stmt.all(roomId) as Record<string, unknown>[]

    return rows.map(row => this.rowToRecord(row))
  }

  /**
   * 更新决策记录
   */
  updateDecision(
    id: number,
    updates: Partial<Omit<DecisionRecord, 'id' | 'createdAt'>>
  ): DecisionRecord | undefined {
    const existing = this.getDecision(id)

    if (!existing) {
      return undefined
    }

    const updated: DecisionRecord = {
      ...existing,
      ...updates,
      updatedAt: Date.now()
    }

    const stmt = this.sqliteService.prepare(`
      UPDATE decisions SET
        decision = ?,
        rationale = ?,
        participants = ?,
        consensus_level = ?,
        metadata = ?,
        updated_at = ?
      WHERE id = ?
    `)

    stmt.run(
      updated.decision,
      updated.rationale,
      JSON.stringify(updated.participants),
      updated.consensusLevel,
      JSON.stringify(updated.metadata || {}),
      updated.updatedAt,
      id
    )

    return updated
  }

  /**
   * 删除决策记录
   */
  deleteDecision(id: number): boolean {
    const stmt = this.sqliteService.prepare(`
      DELETE FROM decisions WHERE id = ?
    `)

    const result = stmt.run(id)

    return result.changes > 0
  }

  /**
   * 转换数据库行为决策记录
   */
  private rowToRecord(row: Record<string, unknown>): DecisionRecord {
    return {
      id: row.id as number,
      issueId: row.issue_id as string,
      roomId: row.room_id as string,
      decision: row.decision as string,
      rationale: row.rationale as string,
      participants: JSON.parse(row.participants as string),
      consensusLevel: row.consensus_level as number,
      metadata: JSON.parse(row.metadata as string),
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number
    }
  }
}
