// Protocol Message Types

export type MessageType =
  | 'extension.hello'
  | 'extension.pong'
  | 'extension.error'
  | 'ai.tab.register'
  | 'ai.tab.unregister'
  | 'ai.tab.status'
  | 'ai.prompt.send'
  | 'ai.response.done'
  | 'ai.response.error'
  | 'room.start'
  | 'room.status'
  | 'room.proposal'
  | 'room.decision'
  | 'room.error'
  | 'conversation.list'
  | 'conversation.get'
  | 'conversation.delete'
  | 'conversation.rename'
  | 'conversation.share'
  | 'conversation.list.result'
  | 'conversation.get.result'
  | 'conversation.delete.result'
  | 'conversation.rename.result'
  | 'conversation.share.result'
  | 'conversation.error'
  | 'auth.status'
  | 'auth.status.result'
  | 'auth.refresh'
  | 'auth.refresh.result'
  | 'project.list'
  | 'project.get'
  | 'project.create'
  | 'project.update'
  | 'project.delete'
  | 'project.share'
  | 'project.conversations'
  | 'project.add'
  | 'project.remove'
  | 'project.list.result'
  | 'project.get.result'
  | 'project.create.result'
  | 'project.update.result'
  | 'project.delete.result'
  | 'project.share.result'
  | 'project.conversations.result'
  | 'project.add.result'
  | 'project.remove.result'
  | 'project.error'
  | 'ping'
  | 'pong'

export type Provider = 'chatgpt' | 'claude' | 'gemini' | 'deepseek' | 'kimi' | 'doubao' | 'qwen'

export type ParticipantStatus = 'ready' | 'busy' | 'waiting' | 'login_required' | 'error' | 'offline'

// Extension Hello
export interface ExtensionHelloMessage {
  type: 'extension.hello'
  clientId: string
  extensionId: string
  version: string
  pairingToken: string
}

// AI Tab Register
export interface AiTabRegisterMessage {
  type: 'ai.tab.register'
  participantId: string
  provider: Provider
  tabId: number
  url: string
  status: ParticipantStatus
}

// AI Tab Unregister
export interface AiTabUnregisterMessage {
  type: 'ai.tab.unregister'
  participantId: string
}

// AI Tab Status Update
export interface AiTabStatusMessage {
  type: 'ai.tab.status'
  participantId: string
  status: ParticipantStatus
}

// AI Prompt Send
export interface AiPromptSendMessage {
  type: 'ai.prompt.send'
  correlationId: string
  participantId: string
  payload: {
    role: string
    prompt: string
  }
}

// AI Response Done
export interface AiResponseDoneMessage {
  type: 'ai.response.done'
  correlationId: string
  participantId: string
  payload: {
    text: string
    parsed?: {
      decision: 'approve' | 'revise' | 'reject'
      blocking_issues: Array<{
        severity: 'low' | 'medium' | 'high' | 'critical'
        category: string
        description: string
        required_change?: string
      }>
      non_blocking_suggestions: string[]
      hidden_risks: string[]
      required_changes: string[]
      confidence: number
    }
  }
}

// AI Response Error
export interface AiResponseErrorMessage {
  type: 'ai.response.error'
  correlationId: string
  participantId: string
  error: {
    code: string
    message: string
  }
}

// Room Start
export interface RoomStartMessage {
  type: 'room.start'
  goal: string
}

// Room Status
export interface RoomStatusMessage {
  type: 'room.status'
  roomId: string
  status: 'idle' | 'running' | 'reviewing' | 'approved' | 'blocked' | 'failed'
  participants: string[]
  currentRound?: number
  maxRounds: number
}

// Room Proposal
export interface RoomProposalMessage {
  type: 'room.proposal'
  proposal: {
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
}

// Room Decision
export interface RoomDecisionMessage {
  type: 'room.decision'
  decision: {
    id: string
    goal: string
    finalProposal: object
    assumptions: string[]
    risks: string[]
    resolvedIssues: string[]
    unresolvedIssues: string[]
    acceptanceCriteria: string[]
    completedAt: string
    rounds: number
  }
}

// Room Error
export interface RoomErrorMessage {
  type: 'room.error'
  error: {
    code: string
    message: string
  }
}

// Union type
export type ProtocolMessage =
  | ExtensionHelloMessage
  | AiTabRegisterMessage
  | AiTabUnregisterMessage
  | AiTabStatusMessage
  | AiPromptSendMessage
  | AiResponseDoneMessage
  | AiResponseErrorMessage
  | RoomStartMessage
  | RoomStatusMessage
  | RoomProposalMessage
  | RoomDecisionMessage
  | RoomErrorMessage
  | ConversationListMessage
  | ConversationGetMessage
  | ConversationDeleteMessage
  | ConversationRenameMessage
  | ConversationShareMessage
  | ConversationListResultMessage
  | ConversationGetResultMessage
  | ConversationDeleteResultMessage
  | ConversationRenameResultMessage
  | ConversationShareResultMessage
  | AuthStatusMessage
  | AuthRefreshMessage
  | AuthStatusResultMessage
  | AuthRefreshResultMessage
  | ProjectListMessage
  | ProjectGetMessage
  | ProjectCreateMessage
  | ProjectUpdateMessage
  | ProjectDeleteMessage
  | ProjectShareMessage
  | ProjectConversationsMessage
  | ProjectAddMessage
  | ProjectRemoveMessage
  | ProjectListResultMessage
  | ProjectGetResultMessage
  | ProjectCreateResultMessage
  | ProjectUpdateResultMessage
  | ProjectDeleteResultMessage
  | ProjectShareResultMessage
  | ProjectConversationsResultMessage
  | ProjectAddResultMessage
  | ProjectRemoveResultMessage

// ============ Conversation Management Messages ============

export interface ConversationListMessage {
  type: 'conversation.list'
  requestId: string
  provider: Provider
  offset?: number
  limit?: number
}

export interface ConversationGetMessage {
  type: 'conversation.get'
  requestId: string
  provider: Provider
  conversationId: string
}

export interface ConversationDeleteMessage {
  type: 'conversation.delete'
  requestId: string
  provider: Provider
  conversationId: string
}

export interface ConversationRenameMessage {
  type: 'conversation.rename'
  requestId: string
  provider: Provider
  conversationId: string
  title: string
}

export interface ConversationShareMessage {
  type: 'conversation.share'
  requestId: string
  provider: Provider
  conversationId: string
  shareWith?: 'public' | 'link_only' | 'private'
  title?: string
}

// Conversation data structures
export interface ConversationInfo {
  id: string
  title: string | null
  create_time: number
  update_time: number
  create_time_formatted?: string
  update_time_formatted?: string
}

export interface ConversationDetail extends ConversationInfo {
  mapping: Record<string, unknown>
  moderation_results: unknown[]
  has_summarization?: boolean
}

export interface ShareResult {
  share_url: string
  share_id: string
}

// Result messages
export interface ConversationListResultMessage {
  type: 'conversation.list.result'
  requestId: string
  success: boolean
  conversations?: ConversationInfo[]
  error?: string
}

export interface ConversationGetResultMessage {
  type: 'conversation.get.result'
  requestId: string
  success: boolean
  conversation?: ConversationDetail
  error?: string
}

export interface ConversationDeleteResultMessage {
  type: 'conversation.delete.result'
  requestId: string
  success: boolean
  deleted?: boolean
  error?: string
}

export interface ConversationRenameResultMessage {
  type: 'conversation.rename.result'
  requestId: string
  success: boolean
  renamed?: boolean
  error?: string
}

export interface ConversationShareResultMessage {
  type: 'conversation.share.result'
  requestId: string
  success: boolean
  shareResult?: ShareResult
  error?: string
}

export interface ConversationErrorMessage {
  type: 'conversation.error'
  requestId: string
  error: {
    code: string
    message: string
  }
}

// ============ Auth Messages ============

export interface AuthStatusMessage {
  type: 'auth.status'
  requestId: string
}

export interface AuthStatusResultMessage {
  type: 'auth.status.result'
  requestId: string
  success: boolean
  status?: {
    chatgpt: { authenticated: boolean; accessToken?: string }
    claude: { authenticated: boolean; accessToken?: string }
  }
  error?: string
}

export interface AuthRefreshMessage {
  type: 'auth.refresh'
  requestId: string
  provider?: Provider
}

export interface AuthRefreshResultMessage {
  type: 'auth.refresh.result'
  requestId: string
  success: boolean
  status?: {
    chatgpt: { authenticated: boolean; accessToken?: string }
    claude: { authenticated: boolean; accessToken?: string }
  }
  error?: string
}

// ============ Project Management Messages ============

export interface ProjectListMessage {
  type: 'project.list'
  requestId: string
  provider: Provider
  offset?: number
  limit?: number
  filter?: 'all' | 'owned' | 'shared'
}

export interface ProjectGetMessage {
  type: 'project.get'
  requestId: string
  provider: Provider
  projectId: string
}

export interface ProjectCreateMessage {
  type: 'project.create'
  requestId: string
  provider: Provider
  name: string
  description?: string
}

export interface ProjectUpdateMessage {
  type: 'project.update'
  requestId: string
  provider: Provider
  projectId: string
  name?: string
  description?: string
}

export interface ProjectDeleteMessage {
  type: 'project.delete'
  requestId: string
  provider: Provider
  projectId: string
}

export interface ProjectShareMessage {
  type: 'project.share'
  requestId: string
  provider: Provider
  projectId: string
  shareWith?: 'public' | 'link_only' | 'private'
  shareTitle?: string
}

export interface ProjectConversationsMessage {
  type: 'project.conversations'
  requestId: string
  provider: Provider
  projectId: string
  offset?: number
  limit?: number
}

export interface ProjectAddMessage {
  type: 'project.add'
  requestId: string
  provider: Provider
  projectId: string
  conversationId: string
}

export interface ProjectRemoveMessage {
  type: 'project.remove'
  requestId: string
  provider: Provider
  projectId: string
  conversationId: string
}

// Project data structures
export interface ProjectInfo {
  id: string
  name: string
  description: string | null
  create_time: string | null
  update_time: string | null
  reading_list: string[]
  is_owner: boolean
  shared_with_me: boolean
  num_conversations: number
}

export interface ShareProjectResult {
  share_url: string
  share_id: string
}

// Result messages
export interface ProjectListResultMessage {
  type: 'project.list.result'
  requestId: string
  success: boolean
  projects?: ProjectInfo[]
  error?: string
}

export interface ProjectGetResultMessage {
  type: 'project.get.result'
  requestId: string
  success: boolean
  project?: ProjectInfo
  error?: string
}

export interface ProjectCreateResultMessage {
  type: 'project.create.result'
  requestId: string
  success: boolean
  project?: ProjectInfo
  error?: string
}

export interface ProjectUpdateResultMessage {
  type: 'project.update.result'
  requestId: string
  success: boolean
  project?: ProjectInfo
  error?: string
}

export interface ProjectDeleteResultMessage {
  type: 'project.delete.result'
  requestId: string
  success: boolean
  deleted?: boolean
  error?: string
}

export interface ProjectShareResultMessage {
  type: 'project.share.result'
  requestId: string
  success: boolean
  shareResult?: ShareProjectResult
  error?: string
}

export interface ProjectConversationsResultMessage {
  type: 'project.conversations.result'
  requestId: string
  success: boolean
  conversations?: ConversationInfo[]
  error?: string
}

export interface ProjectAddResultMessage {
  type: 'project.add.result'
  requestId: string
  success: boolean
  added?: boolean
  error?: string
}

export interface ProjectRemoveResultMessage {
  type: 'project.remove.result'
  requestId: string
  success: boolean
  removed?: boolean
  error?: string
}

export interface ProjectErrorMessage {
  type: 'project.error'
  requestId: string
  error: {
    code: string
    message: string
  }
}
