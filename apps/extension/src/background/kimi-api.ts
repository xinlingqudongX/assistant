/**
 * Kimi API 客户端
 * 支持发送消息 + 会话管理 + 项目管理
 *
 * API Base: https://www.kimi.com/apiv2 (gRPC)
 * 使用 protobufjs 进行消息编解码
 *
 * 主要 API 端点：
 * - kimi.chat.v1.ChatService/ListChats - 列表会话
 * - kimi.chat.v1.ChatService/GetChat - 获取会话
 * - kimi.chat.v1.ChatService/CreateChat - 创建会话
 * - kimi.chat.v1.ChatService/DeleteChat - 删除会话
 * - kimi.chat.v1.ChatService/UpdateChat - 更新会话
 * - kimi.gateway.chat.v1.ChatService/ListMessages - 列表消息
 * - kimi.gateway.account.v1.UserService/ListWorkspaces - 工作空间
 */

import { z } from 'zod'
import { loadProto, encode, decode, toJSON } from './kimi-proto'

// ============ Zod 类型定义 ============

// 消息角色
export const KimiMessageRoleSchema = z.enum(['user', 'assistant', 'system'])
export type KimiMessageRole = z.infer<typeof KimiMessageRoleSchema>

// 消息
export const KimiMessageSchema = z.object({
  role: KimiMessageRoleSchema,
  content: z.string()
})
export type KimiMessage = z.infer<typeof KimiMessageSchema>

// 会话基础
export const KimiConversationBaseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  created_at: z.number(),
  updated_at: z.number(),
  model: z.string().optional()
})
export type KimiConversationBase = z.infer<typeof KimiConversationBaseSchema>

// 会话详情
export const KimiConversationSchema = KimiConversationBaseSchema.extend({
  messages: z.array(KimiMessageSchema).optional(),
  is_archived: z.boolean().optional(),
  is_starred: z.boolean().optional(),
  last_message: KimiMessageSchema.optional(),
  workspace_id: z.string().optional()
})
export type KimiConversation = z.infer<typeof KimiConversationSchema>

// 会话列表响应
export const KimiConversationListResponseSchema = z.object({
  chats: z.array(KimiConversationSchema).optional(),
  total: z.number().optional(),
  has_more: z.boolean().optional()
})
export type KimiConversationListResponse = z.infer<typeof KimiConversationListResponseSchema>

// 分享结果
export const KimiShareResultSchema = z.object({
  share_url: z.string(),
  share_id: z.string()
})
export type KimiShareResult = z.infer<typeof KimiShareResultSchema>

// 项目/工作空间基础
export const KimiProjectBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  created_at: z.number(),
  updated_at: z.number(),
  is_default: z.boolean().optional(),
  member_count: z.number().optional()
})
export type KimiProjectBase = z.infer<typeof KimiProjectBaseSchema>

// 项目详情
export const KimiProjectSchema = KimiProjectBaseSchema.extend({
  chats: z.array(KimiConversationSchema).optional(),
  owner: z.object({
    id: z.string(),
    name: z.string()
  }).optional()
})
export type KimiProject = z.infer<typeof KimiProjectSchema>

// 项目列表响应
export const KimiProjectListResponseSchema = z.object({
  workspaces: z.array(KimiProjectSchema).optional(),
  total: z.number().optional()
})
export type KimiProjectListResponse = z.infer<typeof KimiProjectListResponseSchema>

// 消息项
export const KimiMessageItemSchema = z.object({
  id: z.string(),
  role: KimiMessageRoleSchema,
  content: z.string(),
  created_at: z.number(),
  updated_at: z.number()
})
export type KimiMessageItem = z.infer<typeof KimiMessageItemSchema>

// 消息列表响应
export const KimiMessageListResponseSchema = z.object({
  messages: z.array(KimiMessageItemSchema).optional(),
  total: z.number().optional(),
  has_more: z.boolean().optional()
})
export type KimiMessageListResponse = z.infer<typeof KimiMessageListResponseSchema>

// 发送消息选项
export interface KimiSendMessageOptions {
  conversationId?: string
  parentMessageId?: string
  model?: string
  systemPrompt?: string
  timeoutMs?: number
}

// 发送消息响应
export interface KimiSendResponse {
  text: string
  conversationId: string
  messageId: string
}

// 客户端选项
export interface KimiClientOptions {
  accessToken: string
  conversationId?: string
  parentMessageId?: string
  model?: string
  systemPrompt?: string
  timeoutMs?: number
}

// ============ Kimi API 客户端 ============

const KIMI_API_BASE = 'https://www.kimi.com'

// API 端点映射
const API_ENDPOINTS = {
  // Chat Service
  ListChats: '/apiv2/kimi.chat.v1.ChatService/ListChats',
  GetChat: '/apiv2/kimi.gateway.chat.v1.ChatService/GetChat',
  CreateChat: '/apiv2/kimi.chat.v1.ChatService/CreateChat',
  UpdateChat: '/apiv2/kimi.chat.v1.ChatService/UpdateChat',
  DeleteChat: '/apiv2/kimi.chat.v1.ChatService/DeleteChat',
  ArchiveChat: '/apiv2/kimi.chat.v1.ChatService/ArchiveChat',
  ListMessages: '/apiv2/kimi.gateway.chat.v1.ChatService/ListMessages',
  Completion: '/apiv2/kimi.chat.v1.ChatService/Completion',
  // User/Workspace Service
  ListWorkspaces: '/apiv2/kimi.gateway.account.v1.UserService/ListWorkspaces',
  GetWorkspace: '/apiv2/kimi.gateway.account.v1.UserService/GetWorkspace',
  CreateWorkspace: '/apiv2/kimi.gateway.account.v1.UserService/CreateWorkspace',
  UpdateWorkspace: '/apiv2/kimi.gateway.account.v1.UserService/UpdateWorkspace',
  DeleteWorkspace: '/apiv2/kimi.gateway.account.v1.UserService/DeleteWorkspace',
}

export class KimiAPIClient {
  private accessToken: string
  private conversationId?: string
  private parentMessageId?: string
  private model?: string
  private timeoutMs: number
  private protoLoaded = false

  constructor(options: KimiClientOptions) {
    this.accessToken = options.accessToken
    this.conversationId = options.conversationId
    this.parentMessageId = options.parentMessageId
    this.model = options.model || 'kimi-pro'
    this.timeoutMs = options.timeoutMs || 120000
  }

  /**
   * 获取认证 token
   */
  static async getAccessToken(): Promise<string> {
    const keys = ['token', 'accessToken', 'access_token', 'auth_token', 'sessionToken', 'moonshot_token']
    for (const key of keys) {
      const token = localStorage.getItem(key)
      if (token) return token
    }

    const cookies = document.cookie
    const tokenMatch = cookies.match(/(?:^|;\s*)kimi_token=([^;]+)/)
    if (tokenMatch) return tokenMatch[1]

    throw new Error('No access token found')
  }

  /**
   * 确保 proto 已加载
   */
  private async ensureProto(): Promise<void> {
    if (!this.protoLoaded) {
      await loadProto()
      this.protoLoaded = true
    }
  }

  /**
   * 发送 gRPC 请求
   */
  private async grpcRequest<T>(
    endpoint: string,
    requestType: any,
    requestData: object,
    isStream = false
  ): Promise<any> {
    await this.ensureProto()

    const response = await fetch(`${KIMI_API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-protobuf',
        'Accept': isStream ? 'application/x-protobuf, text/event-stream' : 'application/x-protobuf',
        'Authorization': `Bearer ${this.accessToken}`,
        'X-Grpc-Web': '1'
      },
      body: encode(requestType, requestData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`gRPC request failed: ${response.status} - ${errorText}`)
    }

    if (isStream) {
      return response
    }

    const buffer = await response.arrayBuffer()
    const uint8Array = new Uint8Array(buffer)
    return toJSON(requestType, uint8Array)
  }

  /**
   * 发送消息
   */
  async sendMessage(
    prompt: string,
    options: KimiSendMessageOptions = {}
  ): Promise<KimiSendResponse> {
    const conversationId = options.conversationId || this.conversationId
    const parentMessageId = options.parentMessageId || this.parentMessageId
    const model = options.model || this.model
    const systemPrompt = options.systemPrompt

    await this.ensureProto()
    const types = await import('./kimi-proto').then(m => m.getTypes())

    // 构建消息
    const messages: { role: string; content: { text: string } }[] = []

    if (systemPrompt) {
      messages.push({ role: 'system', content: { text: systemPrompt } })
    }

    messages.push({ role: 'user', content: { text: prompt } })

    const requestData = {
      model,
      messages,
      stream: true,
      ...(conversationId && { conversation_id: conversationId }),
      ...(parentMessageId && { parent_id: parentMessageId })
    }

    const response = await this.grpcRequest(
      API_ENDPOINTS.Completion,
      types.CompletionRequest,
      requestData,
      true
    )

    // 处理流式响应
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('No response body')
    }

    let responseConversationId = conversationId || ''
    let responseMessageId = ''
    let fullText = ''

    const startTime = Date.now()

    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)

          if (data === '[DONE]') {
            continue
          }

          try {
            // 尝试解析 SSE 数据中的 protobuf
            const parsed = JSON.parse(data)
            if (parsed.id && !responseConversationId) {
              responseConversationId = parsed.id
            }
            if (parsed.choices?.[0]?.delta?.content) {
              fullText += parsed.choices[0].delta.content
            }
            if (parsed.id) {
              responseMessageId = parsed.id
            }
          } catch {
            // 尝试作为 protobuf 解码
            try {
              const protoData = atob(data)
              const uint8Array = new Uint8Array(protoData.length)
              for (let i = 0; i < protoData.length; i++) {
                uint8Array[i] = protoData.charCodeAt(i)
              }
              const decoded = toJSON(types.CompletionChunk, uint8Array) as any
              if (decoded.id && !responseConversationId) {
                responseConversationId = decoded.id
              }
              if (decoded.choices?.[0]?.delta?.content) {
                fullText += decoded.choices[0].delta.content
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      if (Date.now() - startTime > this.timeoutMs) {
        throw new Error('Request timeout')
      }
    }

    return {
      text: fullText,
      conversationId: responseConversationId,
      messageId: responseMessageId
    }
  }

  // ============ 会话管理 ============

  /**
   * 获取会话列表
   */
  async listConversations(offset = 0, limit = 20): Promise<KimiConversation[]> {
    const types = await import('./kimi-proto').then(m => m.getTypes())

    const requestData = {
      offset,
      limit,
      workspace_id: '',
      is_archived: false
    }

    const response = await this.grpcRequest(
      API_ENDPOINTS.ListChats,
      types.ListChatsRequest,
      requestData
    ) as any

    const parsed = KimiConversationListResponseSchema.safeParse(response)
    if (parsed.success) {
      return parsed.data.chats || []
    }
    return response.chats || []
  }

  /**
   * 获取会话详情
   */
  async getConversation(conversationId: string): Promise<KimiConversation> {
    const types = await import('./kimi-proto').then(m => m.getTypes())

    const response = await this.grpcRequest(
      API_ENDPOINTS.GetChat,
      types.GetChatRequest,
      { chat_id: conversationId }
    ) as any

    const parsed = KimiConversationSchema.safeParse(response.chat)
    if (parsed.success) {
      return parsed.data
    }
    return response.chat
  }

  /**
   * 创建新会话
   */
  async createConversation(name?: string): Promise<KimiConversation> {
    const types = await import('./kimi-proto').then(m => m.getTypes())

    const response = await this.grpcRequest(
      API_ENDPOINTS.CreateChat,
      types.CreateChatRequest,
      { name: name || '', workspace_id: '' }
    ) as any

    const parsed = KimiConversationSchema.safeParse(response.chat)
    if (parsed.success) {
      return parsed.data
    }
    return response.chat
  }

  /**
   * 更新会话 (重命名)
   */
  async updateConversation(
    conversationId: string,
    updates: { name?: string }
  ): Promise<KimiConversation> {
    const types = await import('./kimi-proto').then(m => m.getTypes())

    const response = await this.grpcRequest(
      API_ENDPOINTS.UpdateChat,
      types.UpdateChatRequest,
      { chat_id: conversationId, name: updates.name }
    ) as any

    const parsed = KimiConversationSchema.safeParse(response.chat)
    if (parsed.success) {
      return parsed.data
    }
    return response.chat
  }

  /**
   * 删除会话
   */
  async deleteConversation(conversationId: string): Promise<void> {
    const types = await import('./kimi-proto').then(m => m.getTypes())

    await this.grpcRequest(
      API_ENDPOINTS.DeleteChat,
      types.DeleteChatRequest,
      { chat_id: conversationId }
    )
  }

  /**
   * 重命名会话
   */
  async renameConversation(conversationId: string, title: string): Promise<KimiConversation> {
    return this.updateConversation(conversationId, { name: title })
  }

  /**
   * 获取归档会话
   */
  async getArchivedConversations(offset = 0, limit = 20): Promise<KimiConversation[]> {
    const types = await import('./kimi-proto').then(m => m.getTypes())

    const response = await this.grpcRequest(
      API_ENDPOINTS.ListChats,
      types.ListChatsRequest,
      { offset, limit, workspace_id: '', is_archived: true }
    ) as any

    const parsed = KimiConversationListResponseSchema.safeParse(response)
    if (parsed.success) {
      return parsed.data.chats || []
    }
    return response.chats || []
  }

  /**
   * 归档会话
   */
  async archiveConversation(conversationId: string): Promise<void> {
    const types = await import('./kimi-proto').then(m => m.getTypes())

    await this.grpcRequest(
      API_ENDPOINTS.ArchiveChat,
      types.ArchiveChatRequest,
      { chat_id: conversationId }
    )
  }

  // ============ 项目管理 ============

  /**
   * 获取项目列表 (工作空间)
   */
  async listProjects(offset = 0, limit = 20): Promise<KimiProject[]> {
    const types = await import('./kimi-proto').then(m => m.getTypes())

    const response = await this.grpcRequest(
      API_ENDPOINTS.ListWorkspaces,
      types.ListWorkspacesRequest,
      { offset, limit }
    ) as any

    const parsed = KimiProjectListResponseSchema.safeParse(response)
    if (parsed.success) {
      return parsed.data.workspaces || []
    }
    return response.workspaces || []
  }

  /**
   * 获取项目详情
   */
  async getProject(projectId: string): Promise<KimiProject> {
    const types = await import('./kimi-proto').then(m => m.getTypes())

    const response = await this.grpcRequest(
      API_ENDPOINTS.GetWorkspace,
      types.GetWorkspaceRequest,
      { workspace_id: projectId }
    ) as any

    const parsed = KimiProjectSchema.safeParse(response.workspace)
    if (parsed.success) {
      return parsed.data
    }
    return response.workspace
  }

  /**
   * 创建项目
   */
  async createProject(name: string, description?: string): Promise<KimiProject> {
    const types = await import('./kimi-proto').then(m => m.getTypes())

    const response = await this.grpcRequest(
      API_ENDPOINTS.CreateWorkspace,
      types.CreateWorkspaceRequest,
      { name, description: description || '' }
    ) as any

    const parsed = KimiProjectSchema.safeParse(response.workspace)
    if (parsed.success) {
      return parsed.data
    }
    return response.workspace
  }

  /**
   * 更新项目
   */
  async updateProject(
    projectId: string,
    updates: { name?: string; description?: string }
  ): Promise<KimiProject> {
    const types = await import('./kimi-proto').then(m => m.getTypes())

    const response = await this.grpcRequest(
      API_ENDPOINTS.UpdateWorkspace,
      types.UpdateWorkspaceRequest,
      { workspace_id: projectId, ...updates }
    ) as any

    const parsed = KimiProjectSchema.safeParse(response.workspace)
    if (parsed.success) {
      return parsed.data
    }
    return response.workspace
  }

  /**
   * 删除项目
   */
  async deleteProject(projectId: string): Promise<void> {
    const types = await import('./kimi-proto').then(m => m.getTypes())

    await this.grpcRequest(
      API_ENDPOINTS.DeleteWorkspace,
      types.DeleteWorkspaceRequest,
      { workspace_id: projectId }
    )
  }

  /**
   * 获取项目下的会话
   */
  async getProjectConversations(
    projectId: string,
    offset = 0,
    limit = 20
  ): Promise<KimiConversation[]> {
    const types = await import('./kimi-proto').then(m => m.getTypes())

    const response = await this.grpcRequest(
      API_ENDPOINTS.ListChats,
      types.ListChatsRequest,
      { offset, limit, workspace_id: projectId, is_archived: false }
    ) as any

    const parsed = KimiConversationListResponseSchema.safeParse(response)
    if (parsed.success) {
      return parsed.data.chats || []
    }
    return response.chats || []
  }
}
