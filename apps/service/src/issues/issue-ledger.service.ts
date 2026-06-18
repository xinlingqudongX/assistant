import { Injectable, Logger } from '@nestjs/common'
import { SQLiteService } from '../storage/sqlite.service'

export interface Issue {
  id?: number
  issueId: string
  roomId: string
  title: string
  description: string
  status: IssueStatus
  priority: IssuePriority
  assignee?: string
  tags?: string[]
  relatedIssues?: string[]
  metadata?: Record<string, unknown>
  createdAt: number
  updatedAt: number
  resolvedAt?: number
}

export enum IssueStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

export enum IssuePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface CreateIssueParams {
  issueId: string
  roomId: string
  title: string
  description?: string
  priority?: IssuePriority
  tags?: string[]
  metadata?: Record<string, unknown>
}

@Injectable()
export class IssueLedgerService {
  private readonly logger = new Logger(IssueLedgerService.name)

  constructor(private readonly sqliteService: SQLiteService) {}

  /**
   * 创建新问题
   */
  async createIssue(params: CreateIssueParams): Promise<Issue> {
    const issue: Issue = {
      issueId: params.issueId,
      roomId: params.roomId,
      title: params.title,
      description: params.description || '',
      status: IssueStatus.OPEN,
      priority: params.priority || IssuePriority.MEDIUM,
      tags: params.tags || [],
      metadata: params.metadata,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    const stmt = this.sqliteService.prepare(`
      INSERT INTO issues (
        issue_id, room_id, title, description, status, priority,
        tags, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const result = stmt.run(
      issue.issueId,
      issue.roomId,
      issue.title,
      issue.description,
      issue.status,
      issue.priority,
      JSON.stringify(issue.tags),
      JSON.stringify(issue.metadata || {}),
      issue.createdAt,
      issue.updatedAt
    )

    issue.id = Number(result.lastInsertRowid)

    this.logger.log(`Issue created: ${issue.issueId}`)

    return issue
  }

  /**
   * 获取问题
   */
  getIssue(idOrIssueId: string | number): Issue | undefined {
    const isNumeric = typeof idOrIssueId === 'number'
    const query = isNumeric
      ? 'SELECT * FROM issues WHERE id = ?'
      : 'SELECT * FROM issues WHERE issue_id = ?'

    const stmt = this.sqliteService.prepare(query)
    const row = stmt.get(idOrIssueId) as Record<string, unknown> | undefined

    if (row) {
      return this.rowToIssue(row)
    }

    return undefined
  }

  /**
   * 按 roomId 获取所有问题
   */
  getIssuesByRoomId(roomId: string, status?: IssueStatus): Issue[] {
    let query = 'SELECT * FROM issues WHERE room_id = ?'
    const params: (string | number)[] = [roomId]

    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }

    query += ' ORDER BY created_at DESC'

    const stmt = this.sqliteService.prepare(query)
    const rows = stmt.all(...params) as Record<string, unknown>[]

    return rows.map(row => this.rowToIssue(row))
  }

  /**
   * 更新问题
   */
  updateIssue(
    idOrIssueId: string | number,
    updates: Partial<Omit<Issue, 'id' | 'issueId' | 'createdAt'>>
  ): Issue | undefined {
    const existing = this.getIssue(idOrIssueId)

    if (!existing) {
      return undefined
    }

    const updated: Issue = {
      ...existing,
      ...updates,
      updatedAt: Date.now()
    }

    const stmt = this.sqliteService.prepare(`
      UPDATE issues SET
        title = ?,
        description = ?,
        status = ?,
        priority = ?,
        assignee = ?,
        tags = ?,
        related_issues = ?,
        metadata = ?,
        resolved_at = ?,
        updated_at = ?
      WHERE id = ?
    `)

    stmt.run(
      updated.title,
      updated.description,
      updated.status,
      updated.priority,
      updated.assignee || null,
      JSON.stringify(updated.tags || []),
      JSON.stringify(updated.relatedIssues || []),
      JSON.stringify(updated.metadata || {}),
      updated.resolvedAt || null,
      updated.updatedAt,
      existing.id!
    )

    return updated
  }

  /**
   * 解决/关闭问题
   */
  resolveIssue(idOrIssueId: string | number): Issue | undefined {
    return this.updateIssue(idOrIssueId, {
      status: IssueStatus.RESOLVED,
      resolvedAt: Date.now()
    })
  }

  /**
   * 删除问题
   */
  deleteIssue(idOrIssueId: string | number): boolean {
    const existing = this.getIssue(idOrIssueId)

    if (!existing) {
      return false
    }

    const stmt = this.sqliteService.prepare('DELETE FROM issues WHERE id = ?')
    const result = stmt.run(existing.id!)

    return result.changes > 0
  }

  /**
   * 添加相关问题
   */
  addRelatedIssue(issueId: string, relatedIssueId: string): void {
    const issue = this.getIssue(issueId)

    if (issue) {
      const related = issue.relatedIssues || []
      if (!related.includes(relatedIssueId)) {
        related.push(relatedIssueId)
        this.updateIssue(issueId, { relatedIssues: related })
      }
    }
  }

  /**
   * 获取统计信息
   */
  getStatistics(roomId: string): {
    total: number
    open: number
    inProgress: number
    resolved: number
    closed: number
  } {
    const stmt = this.sqliteService.prepare(`
      SELECT status, COUNT(*) as count FROM issues WHERE room_id = ? GROUP BY status
    `)

    const rows = stmt.all(roomId) as { status: string; count: number }[]

    const stats = {
      total: 0,
      open: 0,
      inProgress: 0,
      resolved: 0,
      closed: 0
    }

    for (const row of rows) {
      const count = row.count as number
      stats.total += count

      switch (row.status) {
        case IssueStatus.OPEN:
          stats.open = count
          break
        case IssueStatus.IN_PROGRESS:
          stats.inProgress = count
          break
        case IssueStatus.RESOLVED:
          stats.resolved = count
          break
        case IssueStatus.CLOSED:
          stats.closed = count
          break
      }
    }

    return stats
  }

  /**
   * 转换数据库行为问题
   */
  private rowToIssue(row: Record<string, unknown>): Issue {
    return {
      id: row.id as number,
      issueId: row.issue_id as string,
      roomId: row.room_id as string,
      title: row.title as string,
      description: row.description as string,
      status: row.status as IssueStatus,
      priority: row.priority as IssuePriority,
      assignee: row.assignee as string | undefined,
      tags: JSON.parse((row.tags as string) || '[]'),
      relatedIssues: JSON.parse((row.related_issues as string) || '[]'),
      metadata: JSON.parse((row.metadata as string) || '{}'),
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
      resolvedAt: row.resolved_at as number | undefined
    }
  }
}
