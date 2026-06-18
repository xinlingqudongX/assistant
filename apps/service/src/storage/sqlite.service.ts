import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import Database from 'better-sqlite3'
import { join } from 'path'

@Injectable()
export class SQLiteService implements OnModuleInit, OnModuleDestroy {
  private db: Database.Database | null = null
  private dbPath: string

  constructor() {
    this.dbPath = join(process.cwd(), 'data', 'ai-council.db')
  }

  onModuleInit() {
    this.initializeDatabase()
  }

  onModuleDestroy() {
    this.close()
  }

  /**
   * 初始化数据库
   */
  private initializeDatabase(): void {
    // 确保数据目录存在
    const fs = require('fs')
    const dir = require('path').dirname(this.dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    this.db = new Database(this.dbPath)
    this.db.pragma('journal_mode = WAL')
    // 启用外键约束检查
    this.db.pragma('foreign_keys = ON')

    this.createTables()
  }

  /**
   * 创建表
   */
  private createTables(): void {
    if (!this.db) return

    // 参与者表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        participant_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        status TEXT DEFAULT 'online',
        tab_id INTEGER,
        connection_id TEXT,
        capabilities TEXT DEFAULT '[]',
        metadata TEXT DEFAULT '{}',
        last_active INTEGER,
        created_at INTEGER NOT NULL
      )
    `)

    // 房间表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        created_by TEXT NOT NULL,
        participants TEXT DEFAULT '[]',
        issues TEXT DEFAULT '[]',
        metadata TEXT DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // 问题表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_id TEXT UNIQUE NOT NULL,
        room_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'open',
        priority TEXT DEFAULT 'medium',
        assignee TEXT,
        tags TEXT DEFAULT '[]',
        related_issues TEXT DEFAULT '[]',
        metadata TEXT DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        resolved_at INTEGER,
        FOREIGN KEY (room_id) REFERENCES rooms(id)
      )
    `)

    // 决策表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        decision TEXT NOT NULL,
        rationale TEXT,
        participants TEXT DEFAULT '[]',
        consensus_level REAL DEFAULT 0.5,
        metadata TEXT DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (issue_id) REFERENCES issues(issue_id),
        FOREIGN KEY (room_id) REFERENCES rooms(id)
      )
    `)

    // 创建索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_participants_status ON participants(status);
      CREATE INDEX IF NOT EXISTS idx_participants_provider ON participants(provider);
      CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
      CREATE INDEX IF NOT EXISTS idx_issues_room_id ON issues(room_id);
      CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
      CREATE INDEX IF NOT EXISTS idx_decisions_room_id ON decisions(room_id);
      CREATE INDEX IF NOT EXISTS idx_decisions_issue_id ON decisions(issue_id);
    `)
  }

  /**
   * 准备语句
   */
  prepare(sql: string): Database.Statement {
    if (!this.db) {
      throw new Error('Database not initialized')
    }
    return this.db.prepare(sql)
  }

  /**
   * 执行语句
   */
  exec(sql: string): void {
    if (!this.db) {
      throw new Error('Database not initialized')
    }
    this.db.exec(sql)
  }

  /**
   * 关闭数据库
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}
