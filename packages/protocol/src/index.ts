// AI Council Protocol - Unified Export

// Message Types
export type {
  MessageType,
  Provider,
  ParticipantStatus,
  ExtensionHelloMessage,
  AiTabRegisterMessage,
  AiTabUnregisterMessage,
  AiTabStatusMessage,
  AiPromptSendMessage,
  AiResponseDoneMessage,
  AiResponseErrorMessage,
  RoomStartMessage,
  RoomStatusMessage,
  RoomProposalMessage,
  RoomDecisionMessage,
  RoomErrorMessage,
  // Conversation Management
  ConversationListMessage,
  ConversationGetMessage,
  ConversationDeleteMessage,
  ConversationRenameMessage,
  ConversationShareMessage,
  ConversationListResultMessage,
  ConversationGetResultMessage,
  ConversationDeleteResultMessage,
  ConversationRenameResultMessage,
  ConversationShareResultMessage,
  ConversationErrorMessage,
  ConversationInfo,
  ConversationDetail,
  ShareResult,
  // Auth
  AuthStatusMessage,
  AuthStatusResultMessage,
  AuthRefreshMessage,
  AuthRefreshResultMessage,
  // Project Management
  ProjectListMessage,
  ProjectGetMessage,
  ProjectCreateMessage,
  ProjectUpdateMessage,
  ProjectDeleteMessage,
  ProjectShareMessage,
  ProjectConversationsMessage,
  ProjectAddMessage,
  ProjectRemoveMessage,
  ProjectListResultMessage,
  ProjectGetResultMessage,
  ProjectCreateResultMessage,
  ProjectUpdateResultMessage,
  ProjectDeleteResultMessage,
  ProjectShareResultMessage,
  ProjectConversationsResultMessage,
  ProjectAddResultMessage,
  ProjectRemoveResultMessage,
  ProjectErrorMessage,
  ProjectInfo,
  ShareProjectResult,
  ProtocolMessage
} from './messages'

// Audit Role Types
export {
  AUDIT_ROLES,
  DEFAULT_AUDIT_ROLES
} from './roles'
export type { AuditRole, AuditRoleId } from './roles'

// Issue Types
export type { Issue, IssueSeverity, IssueCategory, IssueStatus, IssueLedger } from './issues'
export { createIssue, isBlockingIssue, getOpenBlockingIssues } from './issues'

// Proposal Types
export type { Proposal } from './proposal'
export { createProposal, bumpProposalVersion } from './proposal'

// Audit Result Types
export type { AuditResult, BlockingIssue, AuditDecision } from './audit'
export { isBlockingDecision, hasBlockingIssues, canApprove } from './audit'

// Room Types
export type { Room, Participant, Round, AuditTask, AuditResultParsed, DecisionRecord } from './room'
export type { RoomStatus } from './room'

// Zod Schemas
export {
  ProtocolMessageSchema,
  ExtensionHelloSchema,
  AiTabRegisterSchema,
  AiTabUnregisterSchema,
  AiTabStatusSchema,
  AiPromptSendSchema,
  AiResponseDoneSchema,
  AiResponseErrorSchema,
  AuditResultParsedSchema,
  BlockingIssueSchema,
  ProposalSchema,
  DecisionRecordSchema,
  // Conversation Management
  ConversationListSchema,
  ConversationGetSchema,
  ConversationDeleteSchema,
  ConversationRenameSchema,
  ConversationShareSchema,
  ConversationListResultSchema,
  ConversationGetResultSchema,
  ConversationDeleteResultSchema,
  ConversationRenameResultSchema,
  ConversationShareResultSchema,
  ConversationErrorSchema,
  ConversationInfoSchema,
  ConversationDetailSchema,
  ShareResultSchema,
  // Auth
  AuthStatusSchema,
  AuthStatusResultSchema,
  AuthRefreshSchema,
  AuthRefreshResultSchema,
  // Project Management
  ProjectFilterSchema,
  ProjectInfoSchema,
  ShareProjectResultSchema,
  ProjectListSchema,
  ProjectGetSchema,
  ProjectCreateSchema,
  ProjectUpdateSchema,
  ProjectDeleteSchema,
  ProjectShareSchema,
  ProjectConversationsSchema,
  ProjectAddSchema,
  ProjectRemoveSchema,
  ProjectListResultSchema,
  ProjectGetResultSchema,
  ProjectCreateResultSchema,
  ProjectUpdateResultSchema,
  ProjectDeleteResultSchema,
  ProjectShareResultSchema,
  ProjectConversationsResultSchema,
  ProjectAddResultSchema,
  ProjectRemoveResultSchema,
  ProjectErrorSchema
} from './schemas'
