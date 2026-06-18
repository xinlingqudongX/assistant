// Issue Ledger Types

import type { AuditRoleId } from './roles'

export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical'
export type IssueCategory = 'architecture' | 'security' | 'implementation' | 'product' | 'testability' | 'cost' | 'compliance' | 'unknown'
export type IssueStatus = 'open' | 'resolved' | 'accepted_risk' | 'rejected'

export interface Issue {
  id: string
  proposalVersion: number
  raisedBy: string
  roleId: AuditRoleId
  severity: IssueSeverity
  category: IssueCategory
  description: string
  evidence?: string
  requiredChange?: string
  status: IssueStatus
  resolution?: string
  createdAt: string
  resolvedAt?: string
}

export interface IssueLedger {
  issues: Issue[]
  totalOpen: number
  criticalOpen: number
  highOpen: number
}

export function createIssue(
  partial: Partial<Issue> & {
    raisedBy: string
    roleId: AuditRoleId
    description: string
    severity: IssueSeverity
    category: IssueCategory
    proposalVersion: number
  }
): Issue {
  return {
    id: `issue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    status: 'open',
    createdAt: new Date().toISOString(),
    ...partial
  }
}

export function isBlockingIssue(issue: Issue): boolean {
  return issue.severity === 'high' || issue.severity === 'critical'
}

export function getOpenBlockingIssues(issues: Issue[]): Issue[] {
  return issues.filter(issue => issue.status === 'open' && isBlockingIssue(issue))
}
