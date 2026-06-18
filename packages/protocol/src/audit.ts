// Audit Result Types

export type AuditDecision = 'approve' | 'revise' | 'reject'

export interface AuditResult {
  decision: AuditDecision
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

export function isBlockingDecision(result: AuditResult): boolean {
  return result.decision === 'revise' || result.decision === 'reject'
}

export function hasBlockingIssues(result: AuditResult): boolean {
  return result.blocking_issues.some(issue => issue.severity === 'high' || issue.severity === 'critical')
}

export function canApprove(result: AuditResult): boolean {
  return result.decision === 'approve' && !hasBlockingIssues(result)
}
