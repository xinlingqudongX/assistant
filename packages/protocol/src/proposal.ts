// Proposal Types

export interface Proposal {
  id: string
  version: number
  goal: string
  summary: string
  assumptions: string[]
  design: string
  implementationPlan: string[]
  risks: string[]
  unresolvedIssues: string[]
  acceptanceCriteria: string[]
  createdAt: string
}

export function createProposal(
  goal: string,
  version: number = 1,
  partial: Partial<Proposal> = {}
): Proposal {
  return {
    id: `proposal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    version,
    goal,
    summary: '',
    assumptions: [],
    design: '',
    implementationPlan: [],
    risks: [],
    unresolvedIssues: [],
    acceptanceCriteria: [],
    createdAt: new Date().toISOString(),
    ...partial
  }
}

export function bumpProposalVersion(proposal: Proposal): Proposal {
  return {
    ...proposal,
    version: proposal.version + 1
  }
}
