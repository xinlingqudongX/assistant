import { Injectable } from '@nestjs/common'

export interface ConsensusPromptContext {
  task: string
  context?: Record<string, unknown>
  participants: {
    id: string
    name: string
    model: string
  }[]
}

@Injectable()
export class PromptBuilderService {
  /**
   * 构建共识提示词
   */
  buildConsensusPrompt(context: ConsensusPromptContext): string {
    const { task, context: additionalContext, participants } = context

    const participantList = participants
      .map(p => `- ${p.name} (${p.model})`)
      .join('\n')

    const contextSection = additionalContext
      ? `\n\n## Context\n${JSON.stringify(additionalContext, null, 2)}`
      : ''

    return `You are participating in a consensus-building process with the following AI agents:

${participantList}

${contextSection}

## Task
${task}

## Instructions
1. Analyze the task and provide your proposal
2. Consider the perspectives of other participants
3. Explain your reasoning clearly
4. Provide a confidence score (0-1) for your proposal

Please respond in the following JSON format:
{
  "proposal": "Your main proposal",
  "reasoning": "Your reasoning and analysis",
  "confidence": 0.85
}`
  }

  /**
   * 构建决策提示词
   */
  buildDecisionPrompt(params: {
    task: string
    options: string[]
    criteria?: string[]
    context?: Record<string, unknown>
  }): string {
    const { task, options, criteria, context } = params

    const optionsList = options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')

    const criteriaSection = criteria
      ? `\n\n## Decision Criteria\n${criteria.join('\n')}`
      : ''

    const contextSection = context
      ? `\n\n## Additional Context\n${JSON.stringify(context, null, 2)}`
      : ''

    return `## Decision Task
${task}

## Available Options
${optionsList}
${criteriaSection}
${contextSection}

Please analyze these options and provide your recommendation with reasoning.`
  }

  /**
   * 构建审议提示词
   */
  buildDeliberationPrompt(params: {
    topic: string
    participants: string[]
    history?: string[]
  }): string {
    const { topic, participants, history } = params

    const historySection = history && history.length > 0
      ? `\n\n## Discussion History\n${history.join('\n\n---\n\n')}`
      : ''

    return `## Topic
${topic}

## Participants
${participants.join(', ')}
${historySection}

Please continue the deliberation, considering all previous arguments.`
  }
}
