import { Injectable, Logger } from '@nestjs/common'
import { ParticipantService } from '../participants/participant.service'

export interface ProposalRequest {
  participantId: string
  participantName: string
  task: string
  context?: Record<string, unknown>
}

export interface Proposal {
  participantId: string
  participantName: string
  proposal: string
  reasoning: string
  confidence: number
  timestamp: number
}

export interface ParsedProposal {
  proposal: string
  reasoning: string
  confidence: number
}

@Injectable()
export class ProposalService {
  private readonly logger = new Logger(ProposalService.name)

  constructor(private readonly participantService: ParticipantService) {}

  /**
   * 创建提案
   */
  async createProposal(request: ProposalRequest): Promise<Proposal> {
    const { participantId, participantName, task, context } = request

    const startTime = Date.now()

    try {
      // 获取参与者
      const participant = await this.participantService.getParticipant(participantId)

      if (!participant) {
        throw new Error(`Participant ${participantId} not found`)
      }

      // 发送请求到参与者
      const response = await this.participantService.sendPrompt(participantId, {
        task,
        context,
        timeoutMs: 60000
      })

      // 解析响应
      const parsed = this.parseProposalResponse(response.text)

      this.logger.log(
        `Proposal created by ${participantName} in ${Date.now() - startTime}ms`
      )

      return {
        participantId,
        participantName,
        proposal: parsed.proposal,
        reasoning: parsed.reasoning,
        confidence: parsed.confidence,
        timestamp: Date.now()
      }
    } catch (error) {
      this.logger.error(
        `Failed to create proposal for ${participantName}: ${error}`
      )
      throw error
    }
  }

  /**
   * 解析提案响应
   */
  parseProposalResponse(text: string): ParsedProposal {
    // 尝试从 JSON 中解析
    try {
      // 提取 JSON
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) ||
                       text.match(/\{[\s\S]*"proposal"[\s\S]*\}/)

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0]
        const parsed = JSON.parse(jsonStr)

        return {
          proposal: parsed.proposal || text,
          reasoning: parsed.reasoning || '',
          confidence: parsed.confidence ?? 0.5
        }
      }
    } catch {
      // JSON 解析失败，使用全文
    }

    // 回退：使用全文作为提案
    return {
      proposal: text.trim(),
      reasoning: '',
      confidence: 0.5
    }
  }

  /**
   * 评估提案质量
   */
  evaluateProposal(proposal: Proposal): {
    quality: 'high' | 'medium' | 'low'
    issues: string[]
  } {
    const issues: string[] = []
    let quality: 'high' | 'medium' | 'low' = 'high'

    // 检查提案长度
    if (proposal.proposal.length < 10) {
      issues.push('Proposal is too short')
      quality = 'low'
    } else if (proposal.proposal.length < 50) {
      issues.push('Proposal could be more detailed')
      quality = quality === 'high' ? 'medium' : quality
    }

    // 检查置信度
    if (proposal.confidence < 0.3) {
      issues.push('Low confidence score')
      quality = 'low'
    } else if (proposal.confidence < 0.5) {
      issues.push('Moderate confidence score')
      quality = quality === 'high' ? 'medium' : quality
    }

    // 检查推理
    if (!proposal.reasoning || proposal.reasoning.length < 20) {
      issues.push('Limited reasoning provided')
      quality = quality === 'high' ? 'medium' : quality
    }

    return { quality, issues }
  }
}
