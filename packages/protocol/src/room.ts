// Room, Participant, and Round Types

import type { AuditRoleId } from './roles'
import type { ParticipantStatus, Provider } from './messages'

export type RoomStatus = 'idle' | 'running' | 'reviewing' | 'approved' | 'blocked' | 'failed'

export interface Room {
  id: 'main'
  goal: string
  status: RoomStatus
  participants: Participant[]
  currentProposal?: Proposal
  rounds: Round[]
  issueLedger: Issue[]
  decisionRecord?: DecisionRecord
  maxRounds: number
  createdAt: string
  updatedAt: string
}

export interface Participant {
  id: string
  provider: Provider
  tabId: number
  role?: AuditRoleId
  status: ParticipantStatus
  lastSeenAt: string
  clientId?: string
}

export interface Round {
  id: string
  index: number
  proposalVersion: number
  status: 'running' | 'completed' | 'failed'
  tasks: AuditTask[]
  startedAt: string
  completedAt?: string
}

export interface AuditTask {
  id: string
  roundId: string
  participantId: string
  roleId: AuditRoleId
  status: 'pending' | 'running' | 'completed' | 'failed'
  correlationId: string
  prompt?: string
  response?: string
  parsedResult?: AuditResultParsed
  startedAt?: string
  completedAt?: string
  error?: string
}

export interface AuditResultParsed {
  decision: 'approve' | 'revise' | 'reject'
  blocking_issues: BlockingIssue[]
  non_blocking_suggestions: string[]
  hidden_risks: string[]
  required_changes: string[]
  confidence: number
}

export interface BlockingIssue {
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'architecture' | 'security' | 'implementation' | 'product' | 'testability' | 'cost' | 'compliance' | 'unknown'
  description: string
  required_change?: string
}

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

export interface Issue {
  id: string
  proposalVersion: number
  raisedBy: string
  roleId: AuditRoleId
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'architecture' | 'security' | 'implementation' | 'product' | 'testability' | 'cost' | 'compliance' | 'unknown'
  description: string
  evidence?: string
  requiredChange?: string
  status: 'open' | 'resolved' | 'accepted_risk' | 'rejected'
  resolution?: string
  createdAt: string
  resolvedAt?: string
}

export interface DecisionRecord {
  id: string
  goal: string
  finalProposal: Proposal
  assumptions: string[]
  risks: string[]
  resolvedIssues: Issue[]
  unresolvedIssues: Issue[]
  acceptanceCriteria: string[]
  completedAt: string
  rounds: number
  participants: string[]
}
