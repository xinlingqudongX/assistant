import { Injectable, Logger } from '@nestjs/common'
import { RoomService } from '../room/room.service'
import { ParticipantService, ParticipantStatus } from '../participants/participant.service'
import { IssueLedgerService, IssuePriority, IssueStatus } from '../issues/issue-ledger.service'
import { ExtensionMessageService } from '../ws/extension-message.service'
import { DecisionRecordService } from '../decision/decision-record.service'
import { DEFAULT_ROOM_ID } from '../room/room.state'
import { broadcastToAll } from '../main'
import { v4 as uuidv4 } from 'uuid'
import {
  DecisionStatusDto,
  DecisionResultDto
} from './dto/decision.dto'

/** 单条意见（某轮某 AI） */
interface OpinionEntry {
  participantId: string
  provider: string
  opinion: string
  round: number
  submittedAt: number
}

/** 单条投票（某轮某 AI） */
interface VoteEntry {
  participantId: string
  provider: string
  vote: 'agree' | 'disagree' | 'abstain'
  reason: string
  round: number
  submittedAt: number
}

/** 一轮讨论的快照 */
interface RoundSnapshot {
  round: number
  stage: 'opinion' | 'vote'
  opinions: OpinionEntry[]
  votes: VoteEntry[]
  summary: string
  agreeRatio: number
}

export interface DecisionRequest {
  decisionId: string
  roomId: string
  task: string
  context?: Record<string, any>
  options?: {
    collectOpinions?: boolean
    requireConsensus?: boolean
    timeoutMs?: number
    providers?: string[]
    maxRounds?: number
    consensusThreshold?: number
  }
  status: 'pending' | 'processing' | 'completed' | 'failed'
  participants: string[]
  /** 当前轮次（从 1 开始） */
  round: number
  maxRounds: number
  consensusThreshold: number
  /** 关联的 issueId（落库用） */
  issueId?: string
  /** 每轮最新意见 */
  opinionRound: Map<string, OpinionEntry>
  /** 每轮最新投票 */
  voteRound: Map<string, VoteEntry>
  /** 各轮快照（进 metadata） */
  history: RoundSnapshot[]
  /** 最终结论 */
  summary?: string
  /** 最终共识水平（agree 占比） */
  consensusLevel?: number
  error?: string
  createdAt: number
  completedAt?: number
}

/** correlationId -> { decisionId, kind: 'opinion' | 'vote', round } */
interface CorrelationMeta {
  decisionId: string
  kind: 'opinion' | 'vote'
  round: number
}

@Injectable()
export class DecisionRequestService {
  private readonly logger = new Logger(DecisionRequestService.name)

  // 内存存储决策请求
  private requests: Map<string, DecisionRequest> = new Map()

  // 等待响应的 correlationId -> 元信息
  private correlationMap: Map<string, CorrelationMeta> = new Map()

  constructor(
    private readonly roomService: RoomService,
    private readonly participantService: ParticipantService,
    private readonly issueLedgerService: IssueLedgerService,
    private readonly extensionMessageService: ExtensionMessageService,
    private readonly decisionRecordService: DecisionRecordService
  ) {}

  /**
   * 提交决策请求
   */
  async submitDecisionRequest(request: {
    task: string
    context?: Record<string, any>
    options?: {
      collectOpinions?: boolean
      requireConsensus?: boolean
      timeoutMs?: number
      providers?: string[]
      maxRounds?: number
      consensusThreshold?: number
    }
  }): Promise<DecisionRequest> {
    const decisionId = `decision_${Date.now()}_${uuidv4().substr(0, 8)}`

    // 使用默认房间
    const roomId = DEFAULT_ROOM_ID

    // 确保默认房间存在
    let room = this.roomService.getRoom(roomId)
    if (!room) {
      this.logger.log(`Creating default room: ${roomId}`)
      room = await this.roomService.createRoom({
        name: 'Default Room',
        description: 'AI Council 默认房间',
        createdBy: 'system'
      })
    }

    // 获取参与者列表
    let participants = this.participantService.getAllParticipants()

    // 筛选特定提供商
    if (request.options?.providers?.length) {
      participants = participants.filter(p =>
        request.options!.providers!.includes(p.provider)
      )
    }

    // 筛选在线参与者
    participants = participants.filter(p => p.status === ParticipantStatus.ONLINE)

    const timeoutMs = request.options?.timeoutMs || 60000
    const maxRounds = Math.max(1, request.options?.maxRounds ?? 3)
    const consensusThreshold = request.options?.consensusThreshold ?? 0.6

    // 创建决策请求
    const decisionRequest: DecisionRequest = {
      decisionId,
      roomId,
      task: request.task,
      context: request.context,
      options: request.options,
      status: 'processing',
      participants: participants.map(p => p.participantId),
      round: 0,
      maxRounds,
      consensusThreshold,
      opinionRound: new Map(),
      voteRound: new Map(),
      history: [],
      createdAt: Date.now()
    }

    this.requests.set(decisionId, decisionRequest)

    // 无在线参与者：直接失败
    if (participants.length === 0) {
      decisionRequest.status = 'failed'
      decisionRequest.error = 'No online participants available'
      decisionRequest.completedAt = Date.now()
      this.logger.warn(`Decision ${decisionId} failed: no online participants`)
      return decisionRequest
    }

    // 创建问题记录
    try {
      const issueId = `issue_${Date.now()}_${uuidv4().substr(0, 8)}`
      await this.issueLedgerService.createIssue({
        issueId,
        roomId,
        title: request.task,
        description: JSON.stringify(request.context || {}),
        priority: IssuePriority.MEDIUM
      })
      decisionRequest.issueId = issueId
    } catch (error) {
      this.logger.warn('Failed to create issue:', error)
    }

    // 启动第一轮意见征询
    this.runOpinionRound(decisionRequest)

    // 设置兜底超时
    setTimeout(() => {
      this.completeRequest(decisionId)
    }, timeoutMs)

    return decisionRequest
  }

  /**
   * 运行一轮意见征询
   */
  private runOpinionRound(req: DecisionRequest): void {
    req.round += 1
    req.opinionRound = new Map()
    req.voteRound = new Map()

    const round = req.round
    this.logger.log(`Decision ${req.decisionId} round ${round}: collecting opinions`)

    // 上一轮的分歧点作为额外上下文
    const prevHistory = req.history.length > 0 ? req.history[req.history.length - 1] : null
    const context: Record<string, any> = {
      ...(req.context || {}),
      round,
      stage: 'opinion'
    }
    if (prevHistory) {
      context.previousSummary = prevHistory.summary
      context.previousVotes = prevHistory.votes
    }

    for (const participantId of req.participants) {
      const correlationId = `prompt_${Date.now()}_${uuidv4().substr(0, 8)}`
      this.correlationMap.set(correlationId, {
        decisionId: req.decisionId,
        kind: 'opinion',
        round
      })

      this.extensionMessageService
        .sendPrompt({
          participantId,
          correlationId,
          task: req.task,
          context
        })
        .then(() => {
          // 单个 promise resolve 时不直接推进，统一在 handleParticipantResponse 处理
          // 这里 resolve 仅意味着对方返回了文本，真正的处理在 handleParticipantResponse
        })
        .catch((error) => {
          this.logger.error(
            `Opinion prompt failed for ${participantId} (decision ${req.decisionId}): ${error}`
          )
          // 视为该参与者本轮无意见
          const participant = this.participantService.getParticipant(participantId)
          req.opinionRound.set(participantId, {
            participantId,
            provider: participant?.provider || 'unknown',
            opinion: `[无响应: ${String(error)}]`,
            round,
            submittedAt: Date.now()
          })
          this.maybeAdvance(req.decisionId)
        })
    }
  }

  /**
   * 运行一轮投票
   */
  private runVoteRound(req: DecisionRequest): void {
    req.voteRound = new Map()

    const round = req.round
    this.logger.log(`Decision ${req.decisionId} round ${round}: collecting votes`)

    // 生成本轮意见汇总
    const opinions = Array.from(req.opinionRound.values())
    const summary = this.summarizeOpinions(opinions)

    const voteTask =
      `以下是各方针对该问题的意见汇总：\n\n${summary}\n\n` +
      `原始问题：${req.task}\n\n` +
      `请回答你是否同意上述主流观点。仅回复以下三者之一作为首词，并附一句话理由：\n` +
      `agree（同意）/ disagree（不同意）/ abstain（弃权）。`

    const context: Record<string, any> = {
      ...(req.context || {}),
      round,
      stage: 'vote'
    }

    for (const participantId of req.participants) {
      const correlationId = `vote_${Date.now()}_${uuidv4().substr(0, 8)}`
      this.correlationMap.set(correlationId, {
        decisionId: req.decisionId,
        kind: 'vote',
        round
      })

      this.extensionMessageService
        .sendPrompt({
          participantId,
          correlationId,
          task: voteTask,
          context
        })
        .then(() => {
          // 处理在 handleParticipantResponse 中统一进行
        })
        .catch((error) => {
          this.logger.error(
            `Vote prompt failed for ${participantId} (decision ${req.decisionId}): ${error}`
          )
          const participant = this.participantService.getParticipant(participantId)
          // 网络错误视为弃权
          req.voteRound.set(participantId, {
            participantId,
            provider: participant?.provider || 'unknown',
            vote: 'abstain',
            reason: `[无响应: ${String(error)}]`,
            round,
            submittedAt: Date.now()
          })
          this.maybeAdvance(req.decisionId)
        })
    }
  }

  /**
   * 处理参与者的响应（意见 / 投票），由 main.ts 在收到 ai.response.done 时调用
   */
  handleParticipantResponse(
    correlationId: string,
    participantId: string,
    response: { text: string; parsed?: any }
  ): void {
    const meta = this.correlationMap.get(correlationId)
    if (!meta) {
      return
    }

    const req = this.requests.get(meta.decisionId)
    if (!req) {
      return
    }

    // 防止跨轮的迟到响应污染当前轮
    if (meta.round !== req.round) {
      this.logger.warn(
        `Stale response for decision ${meta.decisionId}: correlation round ${meta.round} != current ${req.round}`
      )
      this.correlationMap.delete(correlationId)
      return
    }

    const participant = this.participantService.getParticipant(participantId)
    const provider = participant?.provider || 'unknown'

    if (meta.kind === 'opinion') {
      req.opinionRound.set(participantId, {
        participantId,
        provider,
        opinion: response.text,
        round: meta.round,
        submittedAt: Date.now()
      })
      this.logger.log(
        `Opinion received from ${participantId} for decision ${meta.decisionId} (round ${meta.round})`
      )
    } else if (meta.kind === 'vote') {
      const { vote, reason } = this.parseVote(response.text)
      req.voteRound.set(participantId, {
        participantId,
        provider,
        vote,
        reason,
        round: meta.round,
        submittedAt: Date.now()
      })
      this.logger.log(
        `Vote ${vote} from ${participantId} for decision ${meta.decisionId} (round ${meta.round})`
      )
    }

    this.correlationMap.delete(correlationId)
    this.maybeAdvance(meta.decisionId)
  }

  /**
   * 处理参与者的错误响应
   */
  handleParticipantError(correlationId: string, participantId: string, error: string): void {
    const meta = this.correlationMap.get(correlationId)
    if (!meta) {
      return
    }

    const req = this.requests.get(meta.decisionId)
    if (!req) {
      return
    }

    if (meta.round !== req.round) {
      this.correlationMap.delete(correlationId)
      return
    }

    const participant = this.participantService.getParticipant(participantId)
    const provider = participant?.provider || 'unknown'

    if (meta.kind === 'opinion') {
      req.opinionRound.set(participantId, {
        participantId,
        provider,
        opinion: `[错误: ${error}]`,
        round: meta.round,
        submittedAt: Date.now()
      })
    } else {
      req.voteRound.set(participantId, {
        participantId,
        provider,
        vote: 'abstain',
        reason: `[错误: ${error}]`,
        round: meta.round,
        submittedAt: Date.now()
      })
    }

    this.correlationMap.delete(correlationId)
    this.maybeAdvance(meta.decisionId)
  }

  /**
   * 判断当前轮是否收齐回复，收齐则推进到下一阶段
   */
  private maybeAdvance(decisionId: string): void {
    const req = this.requests.get(decisionId)
    if (!req || req.status !== 'processing') {
      return
    }

    const expected = req.participants.length

    // 意见轮收齐 → 进入投票轮
    if (req.opinionRound.size >= expected && req.voteRound.size === 0) {
      // 单参与者无需投票，直接完成
      if (expected === 1) {
        const opinions = Array.from(req.opinionRound.values())
        const snap: RoundSnapshot = {
          round: req.round,
          stage: 'opinion',
          opinions,
          votes: [],
          summary: this.summarizeOpinions(opinions),
          agreeRatio: 1
        }
        req.history.push(snap)
        req.summary = snap.summary
        req.consensusLevel = 1
        this.completeRequest(decisionId)
        return
      }
      this.runVoteRound(req)
      return
    }

    // 投票轮收齐 → 评估共识
    if (req.voteRound.size >= expected) {
      this.evaluateConsensus(req)
    }
  }

  /**
   * 评估共识（投票制）：agree / (agree + disagree)，弃权不计入分母
   */
  private evaluateConsensus(req: DecisionRequest): void {
    const votes = Array.from(req.voteRound.values())
    const agree = votes.filter((v) => v.vote === 'agree').length
    const disagree = votes.filter((v) => v.vote === 'disagree').length
    const decisive = agree + disagree
    const agreeRatio = decisive > 0 ? agree / decisive : 0

    const opinions = Array.from(req.opinionRound.values())
    const summary = this.summarizeOpinions(opinions)

    const snap: RoundSnapshot = {
      round: req.round,
      stage: 'vote',
      opinions,
      votes,
      summary,
      agreeRatio
    }
    req.history.push(snap)

    this.logger.log(
      `Decision ${req.decisionId} round ${req.round} consensus: agree=${agree} disagree=${disagree} ratio=${agreeRatio.toFixed(2)}`
    )

    // 达成统一
    if (agreeRatio >= req.consensusThreshold) {
      req.summary = summary
      req.consensusLevel = agreeRatio
      this.completeRequest(req.decisionId)
      return
    }

    // 未达成但仍有轮次 → 再征询一轮意见（带上分歧点）
    if (req.round < req.maxRounds) {
      this.runOpinionRound(req)
      return
    }

    // 超出最大轮数：以多数意见为最终结论，如实记录共识水平
    const finalSummary = this.pickMajoritySummary(req)
    req.summary = finalSummary
    req.consensusLevel = agreeRatio
    this.completeRequest(req.decisionId)
  }

  /**
   * 完成决策请求：落库 + 广播
   */
  private completeRequest(decisionId: string): void {
    const req = this.requests.get(decisionId)
    if (!req) return

    if (req.status === 'completed' || req.status === 'failed') {
      return
    }

    const hasResult = (req.summary && req.history.length > 0) || req.opinionRound.size > 0

    if (hasResult) {
      req.status = 'completed'
      // 若未设置（如单轮超时兜底），用最后一次意见做 summary
      if (!req.summary) {
        const opinions = Array.from(req.opinionRound.values())
        req.summary = opinions.length > 0 ? this.summarizeOpinions(opinions) : ''
      }
      if (req.consensusLevel === undefined) {
        req.consensusLevel = req.history.length > 0
          ? req.history[req.history.length - 1].agreeRatio
          : 0
      }
    } else {
      req.status = 'failed'
      req.error = 'No responses received from participants'
    }

    req.completedAt = Date.now()
    this.requests.set(decisionId, req)

    this.logger.log(`Decision ${decisionId} completed with status: ${req.status}`)

    // 落库到 decisions 表（仅最终结果）
    this.persistDecision(req)

    // 广播决策结果给所有客户端
    this.broadcastDecisionResult(req)
  }

  /**
   * 落库最终结果
   */
  private persistDecision(req: DecisionRequest): void {
    if (!req.issueId) {
      this.logger.warn(`Decision ${req.decisionId} has no issueId, skip persistence`)
      return
    }

    try {
      const finalVotes = req.history
        .filter((h) => h.stage === 'vote')
        .pop()?.votes || []

      const providers = Array.from(
        new Set(
          [...req.opinionRound.values(), ...req.voteRound.values()].map((v) => v.provider)
        )
      )

      this.decisionRecordService.createDecision({
        issueId: req.issueId,
        roomId: req.roomId,
        decision: req.summary || req.task,
        rationale: this.buildRationale(req),
        participants: req.participants,
        consensusLevel: req.consensusLevel ?? 0,
        metadata: {
          decisionId: req.decisionId,
          task: req.task,
          maxRounds: req.maxRounds,
          actualRounds: req.round,
          consensusThreshold: req.consensusThreshold,
          providers,
          finalVotes,
          rounds: req.history
        }
      })

      // 标记 issue 为已解决
      this.issueLedgerService.updateIssue(req.issueId, { status: IssueStatus.RESOLVED })

      this.logger.log(`Decision ${req.decisionId} persisted to decisions table`)
    } catch (error) {
      this.logger.error(`Failed to persist decision ${req.decisionId}: ${error}`)
    }
  }

  /**
   * 构建落库的 rationale：各方最终意见 + 投票概要
   */
  private buildRationale(req: DecisionRequest): string {
    const opinions = Array.from(req.opinionRound.values()).map(
      (o) => `[${o.provider}] ${o.opinion}`
    )
    const lastVote = req.history.filter((h) => h.stage === 'vote').pop()
    const voteLine = lastVote
      ? `\n最终投票：${lastVote.votes
          .map((v) => `${v.provider}=${v.vote}`)
          .join(', ')}（agreeRatio=${lastVote.agreeRatio.toFixed(2)}）`
      : ''

    return `各方意见：\n${opinions.join('\n')}${voteLine}`
  }

  /**
   * 多数意见汇总（超轮数兜底用）
   */
  private pickMajoritySummary(req: DecisionRequest): string {
    const lastVotes = req.history.filter((h) => h.stage === 'vote').pop()
    if (lastVotes) {
      const agreeOpinions = lastVotes.votes
        .filter((v) => v.vote === 'agree')
        .map((v) => v.participantId)
      const note =
        agreeOpinions.length > 0
          ? `（多数支持方：${agreeOpinions.join(', ')}）`
          : '（无明确多数支持）'
      return `${lastVotes.summary}\n\n[未达成共识阈值，取多数意见作为结论] ${note}`
    }
    const opinions = Array.from(req.opinionRound.values())
    return this.summarizeOpinions(opinions)
  }

  /**
   * 广播决策结果
   */
  private broadcastDecisionResult(request: DecisionRequest): void {
    const results: Record<string, any> = {}
    for (const [participantId, opinion] of request.opinionRound) {
      const vote = request.voteRound.get(participantId)
      results[participantId] = {
        opinion: opinion.opinion,
        provider: opinion.provider,
        vote: vote?.vote,
        voteReason: vote?.reason
      }
    }

    broadcastToAll({
      type: 'decision.completed',
      decisionId: request.decisionId,
      status: request.status,
      task: request.task,
      results,
      summary: request.summary,
      consensus: this.checkConsensus(request),
      rounds: request.round,
      createdAt: request.createdAt,
      completedAt: request.completedAt
    })
  }

  /**
   * 汇总意见（简单拼接，标注 provider）
   */
  private summarizeOpinions(
    opinions: Array<{ opinion: string; provider: string }>
  ): string {
    if (opinions.length === 0) {
      return ''
    }
    if (opinions.length === 1) {
      return `[${opinions[0].provider}] ${opinions[0].opinion}`
    }
    const summaries = opinions.map((o) => `[${o.provider}] ${o.opinion}`)
    return `各方意见汇总：\n\n${summaries.join('\n\n')}`
  }

  /**
   * 解析投票文本（容错：大小写、中文）
   */
  private parseVote(text: string): {
    vote: 'agree' | 'disagree' | 'abstain'
    reason: string
  } {
    const trimmed = (text || '').trim()
    const head = trimmed.split(/[\s,，。.\n]/)[0].toLowerCase()

    const agreeSet = new Set(['agree', '同意', '赞同', '支持', 'yes', '支持该观点'])
    const disagreeSet = new Set(['disagree', '不同意', '反对', 'no', '不赞同'])
    const abstainSet = new Set(['abstain', '弃权', '中立', '中立/弃权'])

    let vote: 'agree' | 'disagree' | 'abstain'
    if (agreeSet.has(head) || /同意|赞同|^支持/.test(trimmed)) {
      vote = 'agree'
    } else if (disagreeSet.has(head) || /不同意|反对/.test(trimmed)) {
      vote = 'disagree'
    } else if (abstainSet.has(head) || /弃权|中立/.test(trimmed)) {
      vote = 'abstain'
    } else {
      // 无法解析默认弃权
      vote = 'abstain'
    }

    return { vote, reason: trimmed }
  }

  /**
   * 获取决策状态
   */
  getDecisionStatus(decisionId: string): DecisionStatusDto | null {
    const request = this.requests.get(decisionId)
    if (!request) {
      return null
    }

    return {
      decisionId: request.decisionId,
      status: request.status,
      participantCount: request.participants.length,
      responsesReceived: request.opinionRound.size,
      error: request.error,
      createdAt: request.createdAt,
      completedAt: request.completedAt
    }
  }

  /**
   * 获取决策结果
   */
  getDecisionResult(decisionId: string): DecisionResultDto | null {
    const request = this.requests.get(decisionId)
    if (!request) {
      return null
    }

    const results: Record<string, any> = {}
    for (const [participantId, opinion] of request.opinionRound) {
      const vote = request.voteRound.get(participantId)
      results[participantId] = {
        opinion: opinion.opinion,
        provider: opinion.provider,
        participantId,
        vote: vote?.vote,
        voteReason: vote?.reason
      }
    }

    return {
      decisionId: request.decisionId,
      status: request.status,
      results: Object.keys(results).length > 0 ? results : undefined,
      summary: request.summary,
      consensus: this.checkConsensus(request),
      createdAt: request.createdAt,
      completedAt: request.completedAt
    }
  }

  /**
   * 检查共识（基于真实投票统计）
   */
  private checkConsensus(request: DecisionRequest): { reached: boolean; level: number } | undefined {
    const level = request.consensusLevel ?? 0
    const lastVote = request.history.filter((h) => h.stage === 'vote').pop()

    if (!lastVote && request.history.length === 0) {
      return { reached: false, level: 0 }
    }

    return {
      reached: level >= request.consensusThreshold,
      level
    }
  }

  /**
   * 列出所有决策
   */
  listDecisions(): DecisionRequest[] {
    return Array.from(this.requests.values())
  }
}
