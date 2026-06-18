import { z } from 'zod'

// Provider Schema
export const ProviderSchema = z.enum(['chatgpt', 'claude', 'gemini', 'deepseek', 'kimi', 'doubao', 'qwen'])

// Participant Status Schema
export const ParticipantStatusSchema = z.enum([
  'ready',
  'busy',
  'waiting',
  'login_required',
  'error',
  'offline'
])

// Audit Decision Schema
export const AuditDecisionSchema = z.enum(['approve', 'revise', 'reject'])

// Issue Severity Schema
export const IssueSeveritySchema = z.enum(['low', 'medium', 'high', 'critical'])

// Issue Category Schema
export const IssueCategorySchema = z.enum([
  'architecture',
  'security',
  'implementation',
  'product',
  'testability',
  'cost',
  'compliance',
  'unknown'
])

// Issue Status Schema
export const IssueStatusSchema = z.enum(['open', 'resolved', 'accepted_risk', 'rejected'])

// Blocking Issue Schema
export const BlockingIssueSchema = z.object({
  severity: IssueSeveritySchema,
  category: IssueCategorySchema,
  description: z.string(),
  required_change: z.string().optional()
})

// Audit Result Parsed Schema
export const AuditResultParsedSchema = z.object({
  decision: AuditDecisionSchema,
  blocking_issues: z.array(BlockingIssueSchema),
  non_blocking_suggestions: z.array(z.string()),
  hidden_risks: z.array(z.string()),
  required_changes: z.array(z.string()),
  confidence: z.number().min(0).max(1)
})

// Extension Hello Schema
export const ExtensionHelloSchema = z.object({
  type: z.literal('extension.hello'),
  clientId: z.string(),
  extensionId: z.string(),
  version: z.string(),
  pairingToken: z.string()
})

// AI Tab Register Schema
export const AiTabRegisterSchema = z.object({
  type: z.literal('ai.tab.register'),
  participantId: z.string(),
  provider: ProviderSchema,
  tabId: z.number(),
  url: z.string().url(),
  status: ParticipantStatusSchema
})

// AI Tab Unregister Schema
export const AiTabUnregisterSchema = z.object({
  type: z.literal('ai.tab.unregister'),
  participantId: z.string()
})

// AI Tab Status Schema
export const AiTabStatusSchema = z.object({
  type: z.literal('ai.tab.status'),
  participantId: z.string(),
  status: ParticipantStatusSchema
})

// AI Prompt Send Schema
export const AiPromptSendSchema = z.object({
  type: z.literal('ai.prompt.send'),
  correlationId: z.string(),
  participantId: z.string(),
  payload: z.object({
    role: z.string(),
    prompt: z.string()
  })
})

// AI Response Done Schema
export const AiResponseDoneSchema = z.object({
  type: z.literal('ai.response.done'),
  correlationId: z.string(),
  participantId: z.string(),
  payload: z.object({
    text: z.string(),
    parsed: AuditResultParsedSchema.optional()
  })
})

// AI Response Error Schema
export const AiResponseErrorSchema = z.object({
  type: z.literal('ai.response.error'),
  correlationId: z.string(),
  participantId: z.string(),
  error: z.object({
    code: z.string(),
    message: z.string()
  })
})

// Room Start Schema
export const RoomStartSchema = z.object({
  type: z.literal('room.start'),
  goal: z.string()
})

// Room Status Schema
export const RoomStatusSchema = z.object({
  type: z.literal('room.status'),
  roomId: z.string(),
  status: z.enum(['idle', 'running', 'reviewing', 'approved', 'blocked', 'failed']),
  participants: z.array(z.string()),
  currentRound: z.number().optional(),
  maxRounds: z.number()
})

// Proposal Schema
export const ProposalSchema = z.object({
  id: z.string(),
  version: z.number(),
  goal: z.string(),
  summary: z.string(),
  assumptions: z.array(z.string()),
  design: z.string(),
  implementationPlan: z.array(z.string()),
  risks: z.array(z.string()),
  unresolvedIssues: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  createdAt: z.string()
})

// Room Proposal Schema
export const RoomProposalSchema = z.object({
  type: z.literal('room.proposal'),
  proposal: ProposalSchema
})

// Decision Record Schema
export const DecisionRecordSchema = z.object({
  id: z.string(),
  goal: z.string(),
  finalProposal: z.record(z.unknown()),
  assumptions: z.array(z.string()),
  risks: z.array(z.string()),
  resolvedIssues: z.array(z.string()),
  unresolvedIssues: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  completedAt: z.string(),
  rounds: z.number()
})

// Room Decision Schema
export const RoomDecisionSchema = z.object({
  type: z.literal('room.decision'),
  decision: DecisionRecordSchema
})

// Room Error Schema
export const RoomErrorSchema = z.object({
  type: z.literal('room.error'),
  error: z.object({
    code: z.string(),
    message: z.string()
  })
})

// Ping/Pong schemas
export const PingSchema = z.object({
  type: z.literal('ping')
})

export const PongSchema = z.object({
  type: z.literal('pong')
})

// ============ Conversation Management Schemas ============

// ShareWith Schema
export const ShareWithSchema = z.enum(['public', 'link_only', 'private'])

// Conversation Info Schema
export const ConversationInfoSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  create_time: z.number(),
  update_time: z.number(),
  create_time_formatted: z.string().optional(),
  update_time_formatted: z.string().optional()
})

// Conversation Detail Schema
export const ConversationDetailSchema = ConversationInfoSchema.extend({
  mapping: z.record(z.unknown()),
  moderation_results: z.array(z.unknown()),
  has_summarization: z.boolean().optional()
})

// Share Result Schema
export const ShareResultSchema = z.object({
  share_url: z.string(),
  share_id: z.string()
})

// Conversation List Schema
export const ConversationListSchema = z.object({
  type: z.literal('conversation.list'),
  requestId: z.string(),
  provider: ProviderSchema,
  offset: z.number().optional(),
  limit: z.number().optional()
})

// Conversation Get Schema
export const ConversationGetSchema = z.object({
  type: z.literal('conversation.get'),
  requestId: z.string(),
  provider: ProviderSchema,
  conversationId: z.string()
})

// Conversation Delete Schema
export const ConversationDeleteSchema = z.object({
  type: z.literal('conversation.delete'),
  requestId: z.string(),
  provider: ProviderSchema,
  conversationId: z.string()
})

// Conversation Rename Schema
export const ConversationRenameSchema = z.object({
  type: z.literal('conversation.rename'),
  requestId: z.string(),
  provider: ProviderSchema,
  conversationId: z.string(),
  title: z.string()
})

// Conversation Share Schema
export const ConversationShareSchema = z.object({
  type: z.literal('conversation.share'),
  requestId: z.string(),
  provider: ProviderSchema,
  conversationId: z.string(),
  shareWith: ShareWithSchema.optional(),
  title: z.string().optional()
})

// Conversation Result Schemas
export const ConversationListResultSchema = z.object({
  type: z.literal('conversation.list.result'),
  requestId: z.string(),
  success: z.boolean(),
  conversations: z.array(ConversationInfoSchema).optional(),
  error: z.string().optional()
})

export const ConversationGetResultSchema = z.object({
  type: z.literal('conversation.get.result'),
  requestId: z.string(),
  success: z.boolean(),
  conversation: ConversationDetailSchema.optional(),
  error: z.string().optional()
})

export const ConversationDeleteResultSchema = z.object({
  type: z.literal('conversation.delete.result'),
  requestId: z.string(),
  success: z.boolean(),
  deleted: z.boolean().optional(),
  error: z.string().optional()
})

export const ConversationRenameResultSchema = z.object({
  type: z.literal('conversation.rename.result'),
  requestId: z.string(),
  success: z.boolean(),
  renamed: z.boolean().optional(),
  error: z.string().optional()
})

export const ConversationShareResultSchema = z.object({
  type: z.literal('conversation.share.result'),
  requestId: z.string(),
  success: z.boolean(),
  shareResult: ShareResultSchema.optional(),
  error: z.string().optional()
})

export const ConversationErrorSchema = z.object({
  type: z.literal('conversation.error'),
  requestId: z.string(),
  error: z.object({
    code: z.string(),
    message: z.string()
  })
})

// ============ Auth Schemas ============

export const AuthStatusSchema = z.object({
  type: z.literal('auth.status'),
  requestId: z.string()
})

export const AuthStatusResultSchema = z.object({
  type: z.literal('auth.status.result'),
  requestId: z.string(),
  success: z.boolean(),
  status: z
    .object({
      chatgpt: z.object({
        authenticated: z.boolean(),
        accessToken: z.string().optional()
      }),
      claude: z.object({
        authenticated: z.boolean(),
        accessToken: z.string().optional()
      })
    })
    .optional(),
  error: z.string().optional()
})

export const AuthRefreshSchema = z.object({
  type: z.literal('auth.refresh'),
  requestId: z.string(),
  provider: ProviderSchema.optional()
})

export const AuthRefreshResultSchema = z.object({
  type: z.literal('auth.refresh.result'),
  requestId: z.string(),
  success: z.boolean(),
  status: z
    .object({
      chatgpt: z.object({
        authenticated: z.boolean(),
        accessToken: z.string().optional()
      }),
      claude: z.object({
        authenticated: z.boolean(),
        accessToken: z.string().optional()
      })
    })
    .optional(),
  error: z.string().optional()
})

// ============ Project Management Schemas ============

// Project Filter Schema
export const ProjectFilterSchema = z.enum(['all', 'owned', 'shared'])

// Project Info Schema
export const ProjectInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  create_time: z.string().nullable(),
  update_time: z.string().nullable(),
  reading_list: z.array(z.string()),
  is_owner: z.boolean(),
  shared_with_me: z.boolean(),
  num_conversations: z.number()
})

// Share Project Result Schema
export const ShareProjectResultSchema = z.object({
  share_url: z.string(),
  share_id: z.string()
})

// Project List Schema
export const ProjectListSchema = z.object({
  type: z.literal('project.list'),
  requestId: z.string(),
  provider: ProviderSchema,
  offset: z.number().optional(),
  limit: z.number().optional(),
  filter: ProjectFilterSchema.optional()
})

// Project Get Schema
export const ProjectGetSchema = z.object({
  type: z.literal('project.get'),
  requestId: z.string(),
  provider: ProviderSchema,
  projectId: z.string()
})

// Project Create Schema
export const ProjectCreateSchema = z.object({
  type: z.literal('project.create'),
  requestId: z.string(),
  provider: ProviderSchema,
  name: z.string(),
  description: z.string().optional()
})

// Project Update Schema
export const ProjectUpdateSchema = z.object({
  type: z.literal('project.update'),
  requestId: z.string(),
  provider: ProviderSchema,
  projectId: z.string(),
  name: z.string().optional(),
  description: z.string().optional()
})

// Project Delete Schema
export const ProjectDeleteSchema = z.object({
  type: z.literal('project.delete'),
  requestId: z.string(),
  provider: ProviderSchema,
  projectId: z.string()
})

// Project Share Schema
export const ProjectShareSchema = z.object({
  type: z.literal('project.share'),
  requestId: z.string(),
  provider: ProviderSchema,
  projectId: z.string(),
  shareWith: ShareWithSchema.optional(),
  shareTitle: z.string().optional()
})

// Project Conversations Schema
export const ProjectConversationsSchema = z.object({
  type: z.literal('project.conversations'),
  requestId: z.string(),
  provider: ProviderSchema,
  projectId: z.string(),
  offset: z.number().optional(),
  limit: z.number().optional()
})

// Project Add Schema
export const ProjectAddSchema = z.object({
  type: z.literal('project.add'),
  requestId: z.string(),
  provider: ProviderSchema,
  projectId: z.string(),
  conversationId: z.string()
})

// Project Remove Schema
export const ProjectRemoveSchema = z.object({
  type: z.literal('project.remove'),
  requestId: z.string(),
  provider: ProviderSchema,
  projectId: z.string(),
  conversationId: z.string()
})

// Project Result Schemas
export const ProjectListResultSchema = z.object({
  type: z.literal('project.list.result'),
  requestId: z.string(),
  success: z.boolean(),
  projects: z.array(ProjectInfoSchema).optional(),
  error: z.string().optional()
})

export const ProjectGetResultSchema = z.object({
  type: z.literal('project.get.result'),
  requestId: z.string(),
  success: z.boolean(),
  project: ProjectInfoSchema.optional(),
  error: z.string().optional()
})

export const ProjectCreateResultSchema = z.object({
  type: z.literal('project.create.result'),
  requestId: z.string(),
  success: z.boolean(),
  project: ProjectInfoSchema.optional(),
  error: z.string().optional()
})

export const ProjectUpdateResultSchema = z.object({
  type: z.literal('project.update.result'),
  requestId: z.string(),
  success: z.boolean(),
  project: ProjectInfoSchema.optional(),
  error: z.string().optional()
})

export const ProjectDeleteResultSchema = z.object({
  type: z.literal('project.delete.result'),
  requestId: z.string(),
  success: z.boolean(),
  deleted: z.boolean().optional(),
  error: z.string().optional()
})

export const ProjectShareResultSchema = z.object({
  type: z.literal('project.share.result'),
  requestId: z.string(),
  success: z.boolean(),
  shareResult: ShareProjectResultSchema.optional(),
  error: z.string().optional()
})

export const ProjectConversationsResultSchema = z.object({
  type: z.literal('project.conversations.result'),
  requestId: z.string(),
  success: z.boolean(),
  conversations: z.array(ConversationInfoSchema).optional(),
  error: z.string().optional()
})

export const ProjectAddResultSchema = z.object({
  type: z.literal('project.add.result'),
  requestId: z.string(),
  success: z.boolean(),
  added: z.boolean().optional(),
  error: z.string().optional()
})

export const ProjectRemoveResultSchema = z.object({
  type: z.literal('project.remove.result'),
  requestId: z.string(),
  success: z.boolean(),
  removed: z.boolean().optional(),
  error: z.string().optional()
})

export const ProjectErrorSchema = z.object({
  type: z.literal('project.error'),
  requestId: z.string(),
  error: z.object({
    code: z.string(),
    message: z.string()
  })
})

// Update ProtocolMessageSchema with new schemas
export const ProtocolMessageSchema = z.discriminatedUnion('type', [
  ExtensionHelloSchema,
  AiTabRegisterSchema,
  AiTabUnregisterSchema,
  AiTabStatusSchema,
  AiPromptSendSchema,
  AiResponseDoneSchema,
  AiResponseErrorSchema,
  RoomStartSchema,
  RoomStatusSchema,
  RoomProposalSchema,
  RoomDecisionSchema,
  RoomErrorSchema,
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
  // Auth
  AuthStatusSchema,
  AuthStatusResultSchema,
  AuthRefreshSchema,
  AuthRefreshResultSchema,
  // Project Management
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
  ProjectErrorSchema,
  // Ping/Pong
  PingSchema,
  PongSchema
])
