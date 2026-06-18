import { Injectable } from '@nestjs/common'
import { ProposalService } from './proposal.service'
import { PromptBuilderService } from './prompt-builder.service'
import { ParticipantService } from '../participants/participant.service'

export interface ConsensusRequest {
  issueId: string
  task: string
  context?: Record<string, unknown>
}

export interface ConsensusResponse {
  issueId: string
  consensus: string
  proposals: Proposal[]
  timestamp: number
}

export interface Proposal {
  participantId: string
  participantName: string
  proposal: string
  reasoning: string
  confidence: number
  timestamp: number
}

@Injectable()
export class ConsensusService {
  constructor(
    private readonly proposalService: ProposalService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly participantService: ParticipantService
  ) {}

  async reachConsensus(request: ConsensusRequest): Promise<ConsensusResponse> {
    const { issueId, task, context } = request

    // 1. 获取所有在线参与者
    const participants = await this.participantService.getOnlineParticipants()

    if (participants.length === 0) {
      throw new Error('No online participants')
    }

    // 2. 构建提示词
    const prompt = this.promptBuilder.buildConsensusPrompt({
      task,
      context,
      participants: participants.map(p => ({
        id: p.id,
        name: p.name,
        model: p.model
      }))
    })

    // 3. 并行收集所有参与者的提案
    const proposalResults = await Promise.allSettled(
      participants.map(participant =>
        this.proposalService.createProposal({
          participantId: participant.id,
          participantName: participant.name,
          task: prompt,
          context
        })
      )
    )

    // 4. 过滤成功的提案
    const proposals: Proposal[] = proposalResults
      .filter((result): result is PromiseFulfilledResult<Proposal> =>
        result.status === 'fulfilled'
      )
      .map(result => result.value)

    // 5. 计算共识
    const consensus = this.calculateConsensus(proposals)

    // 6. 返回结果
    return {
      issueId,
      consensus: consensus.text,
      proposals,
      timestamp: Date.now()
    }
  }

  /**
   * 计算共识
   * 简单实现：使用投票或加权平均
   */
  private calculateConsensus(proposals: Proposal[]): { text: string; confidence: number } {
    if (proposals.length === 0) {
      return { text: 'No consensus reached', confidence: 0 }
    }

    // 按置信度排序
    const sorted = [...proposals].sort((a, b) => b.confidence - a.confidence)

    // 获取最高置信度的提案
    const topProposal = sorted[0]

    // 计算加权置信度
    const totalConfidence = sorted.reduce((sum, p) => sum + p.confidence, 0)
    const weightedConfidence = totalConfidence / proposals.length

    return {
      text: topProposal.proposal,
      confidence: weightedConfidence
    }
  }

  /**
   * 验证共识
   */
  async validateConsensus(issueId: string, consensus: string): Promise<boolean> {
    // 可以添加额外的验证逻辑
    return consensus.length > 0
  }
}
