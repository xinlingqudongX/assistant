import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

/**
 * 决策选项 schema
 */
const DecisionOptionsSchema = z.object({
  /** 是否收集各方意见（默认 true） */
  collectOpinions: z.boolean().optional(),
  /** 是否要求达成共识（默认 false） */
  requireConsensus: z.boolean().optional(),
  /** 超时时间（毫秒，默认 60000） */
  timeoutMs: z.number().optional(),
  /** 参与决策的 AI 提供商列表，默认全部 */
  providers: z.array(z.string()).optional(),
  /** 最大讨论轮次（意见+投票计为一轮，默认 3） */
  maxRounds: z.number().int().min(1).optional(),
  /** 共识阈值：agree/(agree+disagree) 达到该值视为达成统一（默认 0.6） */
  consensusThreshold: z.number().min(0).max(1).optional()
})

/**
 * 提交决策请求 schema
 */
export const DecisionRequestSchema = z.object({
  task: z.string().min(1, '任务描述不能为空'),
  context: z.record(z.unknown()).optional(),
  options: DecisionOptionsSchema.optional()
})

export class DecisionRequestDto extends createZodDto(DecisionRequestSchema) {}

export class DecisionRequestResponseDto {
  decisionId: string
  status: string
  createdAt: number
}

/**
 * 决策状态
 */
export class DecisionStatusDto {
  decisionId: string
  status: string
  participantCount: number
  responsesReceived: number
  error?: string
  createdAt: number
  completedAt?: number
}

/**
 * 决策结果
 */
export class DecisionResultDto {
  decisionId: string
  status: string
  results?: Record<string, {
    opinion: string
    confidence?: number
    provider: string
    participantId: string
  }>
  summary?: string
  consensus?: {
    reached: boolean
    level: number
  }
  createdAt: number
  completedAt?: number
}

/**
 * 参与者意见
 */
export class ParticipantOpinionDto {
  participantId: string
  provider: string
  opinion: string
  confidence?: number
  submittedAt: number
}
