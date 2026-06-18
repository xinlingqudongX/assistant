import { Injectable, Logger } from '@nestjs/common'
import { RoomService } from '../room/room.service'
import { ParticipantService } from '../participants/participant.service'
import { IssueLedgerService } from '../issues/issue-ledger.service'
import { DecisionRecordService } from '../decision/decision-record.service'
import { ConsensusService } from '../consensus/consensus.service'

/**
 * MCP (Model Context Protocol) 工具定义
 */

export interface McpTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
}

export interface McpResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

export interface McpCallToolRequest {
  name: string
  arguments?: Record<string, any>
}

export interface McpCallToolResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    mimeType?: string
    resource?: { uri: string; text: string }
  }>
  isError?: boolean
}

@Injectable()
export class McpToolsService {
  private readonly logger = new Logger(McpToolsService.name)

  // MCP 协议版本
  readonly protocolVersion = '2024-11-05'

  constructor(
    private readonly roomService: RoomService,
    private readonly participantService: ParticipantService,
    private readonly issueLedgerService: IssueLedgerService,
    private readonly decisionService: DecisionRecordService,
    private readonly consensusService: ConsensusService
  ) {}

  /**
   * 获取所有可用工具
   */
  getTools(): McpTool[] {
    return [
      // ============ 房间管理工具 ============
      {
        name: 'room_create',
        description: '创建一个新的 AI Council 房间，用于组织多个 AI 模型参与讨论和决策',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '房间名称' },
            description: { type: 'string', description: '房间描述（可选）' }
          },
          required: ['name']
        }
      },
      {
        name: 'room_list',
        description: '列出所有 AI Council 房间',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'room_get',
        description: '获取指定房间的详细信息',
        inputSchema: {
          type: 'object',
          properties: {
            roomId: { type: 'string', description: '房间 ID' }
          },
          required: ['roomId']
        }
      },
      {
        name: 'room_join',
        description: '加入指定房间',
        inputSchema: {
          type: 'object',
          properties: {
            roomId: { type: 'string', description: '房间 ID' },
            participantId: { type: 'string', description: '参与者 ID' }
          },
          required: ['roomId', 'participantId']
        }
      },
      {
        name: 'room_leave',
        description: '离开指定房间',
        inputSchema: {
          type: 'object',
          properties: {
            roomId: { type: 'string', description: '房间 ID' },
            participantId: { type: 'string', description: '参与者 ID' }
          },
          required: ['roomId', 'participantId']
        }
      },
      {
        name: 'room_close',
        description: '关闭指定房间',
        inputSchema: {
          type: 'object',
          properties: {
            roomId: { type: 'string', description: '房间 ID' }
          },
          required: ['roomId']
        }
      },

      // ============ 问题管理工具 ============
      {
        name: 'issue_create',
        description: '在指定房间创建一个新的问题或议题',
        inputSchema: {
          type: 'object',
          properties: {
            roomId: { type: 'string', description: '房间 ID' },
            title: { type: 'string', description: '问题标题' },
            description: { type: 'string', description: '问题详细描述' },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              description: '优先级（可选，默认 medium）'
            }
          },
          required: ['roomId', 'title']
        }
      },
      {
        name: 'issue_list',
        description: '列出房间中的所有问题',
        inputSchema: {
          type: 'object',
          properties: {
            roomId: { type: 'string', description: '房间 ID' }
          },
          required: ['roomId']
        }
      },
      {
        name: 'issue_get',
        description: '获取指定问题的详细信息',
        inputSchema: {
          type: 'object',
          properties: {
            issueId: { type: 'string', description: '问题 ID' }
          },
          required: ['issueId']
        }
      },

      // ============ 参与者管理工具 ============
      {
        name: 'participant_list',
        description: '列出所有 AI 参与者',
        inputSchema: {
          type: 'object',
          properties: {
            provider: { type: 'string', description: '按 AI 提供商筛选' }
          }
        }
      },
      {
        name: 'participant_get',
        description: '获取指定参与者的详细信息',
        inputSchema: {
          type: 'object',
          properties: {
            participantId: { type: 'string', description: '参与者 ID' }
          },
          required: ['participantId']
        }
      },
      {
        name: 'participant_send_prompt',
        description: '向指定参与者发送提示词并获取响应',
        inputSchema: {
          type: 'object',
          properties: {
            participantId: { type: 'string', description: '参与者 ID' },
            task: { type: 'string', description: '要执行的任务或问题' },
            context: { type: 'object', description: '额外的上下文信息（可选）' },
            timeoutMs: { type: 'number', description: '超时时间（毫秒，可选，默认 30000）' }
          },
          required: ['participantId', 'task']
        }
      },

      // ============ 共识工具 ============
      {
        name: 'consensus_check',
        description: '检查指定问题的 AI 参与者是否达成共识',
        inputSchema: {
          type: 'object',
          properties: {
            issueId: { type: 'string', description: '问题 ID' }
          },
          required: ['issueId']
        }
      }
    ]
  }

  /**
   * 获取所有可用资源
   */
  getResources(): McpResource[] {
    return [
      {
        uri: 'ai-council://rooms',
        name: '房间列表',
        description: '所有 AI Council 房间的概览',
        mimeType: 'application/json'
      },
      {
        uri: 'ai-council://participants',
        name: '参与者列表',
        description: '所有 AI 参与者的概览',
        mimeType: 'application/json'
      }
    ]
  }

  /**
   * 调用工具
   */
  async callTool(name: string, args: Record<string, any>): Promise<McpCallToolResponse> {
    this.logger.log(`MCP calling tool: ${name}`)

    try {
      switch (name) {
        // 房间管理
        case 'room_create':
          return this.callRoomCreate(args)
        case 'room_list':
          return this.callRoomList(args)
        case 'room_get':
          return this.callRoomGet(args)
        case 'room_join':
          return this.callRoomJoin(args)
        case 'room_leave':
          return this.callRoomLeave(args)
        case 'room_close':
          return this.callRoomClose(args)

        // 问题管理
        case 'issue_create':
          return this.callIssueCreate(args)
        case 'issue_list':
          return this.callIssueList(args)
        case 'issue_get':
          return this.callIssueGet(args)

        // 参与者管理
        case 'participant_list':
          return this.callParticipantList(args)
        case 'participant_get':
          return this.callParticipantGet(args)
        case 'participant_send_prompt':
          return this.callParticipantSendPrompt(args)

        // 共识
        case 'consensus_check':
          return this.callConsensusCheck(args)

        default:
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
            isError: true
          }
      }
    } catch (error) {
      this.logger.error(`Tool ${name} failed:`, error)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: String(error) }) }],
        isError: true
      }
    }
  }

  // ============ 房间管理实现 ============

  private async callRoomCreate(args: any): Promise<McpCallToolResponse> {
    const room = await this.roomService.createRoom({
      name: args.name,
      description: args.description,
      createdBy: 'mcp-client'
    })

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: true, room }, null, 2)
      }]
    }
  }

  private callRoomList(args: any): McpCallToolResponse {
    const rooms = this.roomService.getAllRooms()

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ rooms }, null, 2)
      }]
    }
  }

  private callRoomGet(args: any): McpCallToolResponse {
    const room = this.roomService.getRoom(args.roomId)

    if (!room) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'Room not found' }) }],
        isError: true
      }
    }

    const stats = this.roomService.getRoomStats(args.roomId)

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ room, stats }, null, 2)
      }]
    }
  }

  private callRoomJoin(args: any): McpCallToolResponse {
    const room = this.roomService.addParticipant(args.roomId, args.participantId)

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: !!room, room })
      }]
    }
  }

  private callRoomLeave(args: any): McpCallToolResponse {
    const room = this.roomService.removeParticipant(args.roomId, args.participantId)

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: !!room })
      }]
    }
  }

  private callRoomClose(args: any): McpCallToolResponse {
    const room = this.roomService.closeRoom(args.roomId)

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: !!room, room })
      }]
    }
  }

  // ============ 问题管理实现 ============

  private async callIssueCreate(args: any): Promise<McpCallToolResponse> {
    const issueId = `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const issue = await this.issueLedgerService.createIssue({
      issueId,
      roomId: args.roomId,
      title: args.title,
      description: args.description,
      priority: args.priority || 'medium'
    })

    // 添加到房间
    this.roomService.addIssue(args.roomId, issue.issueId)

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: true, issue }, null, 2)
      }]
    }
  }

  private callIssueList(args: any): McpCallToolResponse {
    const issues = this.issueLedgerService.getIssuesByRoomId(args.roomId)

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ issues }, null, 2)
      }]
    }
  }

  private callIssueGet(args: any): McpCallToolResponse {
    const issue = this.issueLedgerService.getIssue(args.issueId)

    if (!issue) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'Issue not found' }) }],
        isError: true
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ issue }, null, 2)
      }]
    }
  }

  // ============ 参与者管理实现 ============

  private callParticipantList(args: any): McpCallToolResponse {
    let participants = this.participantService.getAllParticipants()

    if (args.provider) {
      participants = participants.filter(p => p.provider === args.provider)
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ participants }, null, 2)
      }]
    }
  }

  private callParticipantGet(args: any): McpCallToolResponse {
    const participant = this.participantService.getParticipant(args.participantId)

    if (!participant) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'Participant not found' }) }],
        isError: true
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ participant }, null, 2)
      }]
    }
  }

  private async callParticipantSendPrompt(args: any): Promise<McpCallToolResponse> {
    try {
      const response = await this.participantService.sendPrompt(args.participantId, {
        task: args.task,
        context: args.context,
        timeoutMs: args.timeoutMs || 30000
      })

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            response: response.text,
            duration: response.duration
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }],
        isError: true
      }
    }
  }

  // ============ 共识实现 ============

  private callConsensusCheck(args: any): McpCallToolResponse {
    const decision = this.decisionService.getDecisionByIssueId(args.issueId)

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          issueId: args.issueId,
          hasDecision: !!decision,
          decision: decision || null
        }, null, 2)
      }]
    }
  }
}
