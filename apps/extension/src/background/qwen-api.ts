/**
 * 通义千问 API 客户端
 * 支持发送消息 + 会话管理 + 项目管理
 *
 * API Base: https://qianwen.aliyun.com (或 https://tongyi.aliyun.com)
 *
 * 主要 API 端点：
 * - /api/v2/chat/list - 列表会话
 * - /api/v2/chat/get - 获取会话
 * - /api/v2/chat/create - 创建会话
 * - /api/v2/chat/delete - 删除会话
 * - /api/v2/chat/update - 更新会话
 * - /api/v2/chat/message - 发送消息
 * - /api/v2/project/list - 列表项目
 * - /api/v2/project/create - 创建项目
 * - /api/v2/project/delete - 删除项目
 */

import { z } from 'zod'

// ============ Zod 类型定义 ============

// 消息角色
export const QwenMessageRoleSchema = z.enum(['user', 'assistant', 'system'])
export type QwenMessageRole = z.infer<typeof QwenMessageRoleSchema>

// 消息
export const QwenMessageSchema = z.object({
  role: QwenMessageRoleSchema,
  content: z.string()
})
export type QwenMessage = z.infer<typeof QwenMessageSchema>

// 会话基础
export const QwenConversationBaseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  created_at: z.number(),
  updated_at: z.number(),
  model: z.string().optional()
})
export type QwenConversationBase = z.infer<typeof QwenConversationBaseSchema>

// 会话详情
export const QwenConversationSchema = QwenConversationBaseSchema.extend({
  messages: z.array(QwenMessageSchema).optional(),
  is_archived: z.boolean().optional(),
  is_starred: z.boolean().optional(),
  last_message: QwenMessageSchema.optional(),
  workspace_id: z.string().nullable().optional()
})
export type QwenConversation = z.infer<typeof QwenConversationSchema>

// 会话列表响应
export const QwenConversationListResponseSchema = z.object({
  chats: z.array(QwenConversationSchema).optional(),
  total: z.number().optional(),
  has_more: z.boolean().optional()
})
export type QwenConversationListResponse = z.infer<typeof QwenConversationListResponseSchema>

// 分享结果
export const QwenShareResultSchema = z.object({
  share_url: z.string(),
  share_id: z.string()
})
export type QwenShareResult = z.infer<typeof QwenShareResultSchema>

// 项目基础
export const QwenProjectBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  created_at: z.number(),
  updated_at: z.number()
})
export type QwenProjectBase = z.infer<typeof QwenProjectBaseSchema>

// 项目详情
export const QwenProjectSchema = QwenProjectBaseSchema.extend({
  chats: z.array(QwenConversationSchema).optional(),
  owner: z.object({
    id: z.string(),
    name: z.string()
  }).optional()
})
export type QwenProject = z.infer<typeof QwenProjectSchema>

// 项目列表响应
export const QwenProjectListResponseSchema = z.object({
  projects: z.array(QwenProjectSchema).optional(),
  total: z.number().optional()
})
export type QwenProjectListResponse = z.infer<typeof QwenProjectListResponseSchema>

// 消息项
export const QwenMessageItemSchema = z.object({
  id: z.string(),
  role: QwenMessageRoleSchema,
  content: z.string(),
  created_at: z.number(),
  updated_at: z.number()
})
export type QwenMessageItem = z.infer<typeof QwenMessageItemSchema>

// 发送消息选项
export interface QwenSendMessageOptions {
  conversationId?: string
  parentMessageId?: string
  model?: string
  systemPrompt?: string
  temperature?: number
  topP?: number
  maxTokens?: number
  timeoutMs?: number
  stream?: boolean
}

// 发送消息响应
export interface QwenSendResponse {
  text: string
  conversationId: string
  messageId: string
}

// 客户端选项
export interface QwenClientOptions {
  accessToken: string
  conversationId?: string
  parentMessageId?: string
  model?: string
  systemPrompt?: string
  timeoutMs?: number
}

// ============ 通义千问 API 客户端 ============

const QWEN_API_BASE = 'https://qianwen.aliyun.com/api/v2'

// API 端点
const API_ENDPOINTS = {
  // 会话管理
  ListChats: '/chat/list',
  GetChat: (id: string) => `/chat/${id}`,
  CreateChat: '/chat/create',
  UpdateChat: (id: string) => `/chat/${id}`,
  DeleteChat: (id: string) => `/chat/${id}`,
  SendMessage: '/chat/message',
  // 消息
  ListMessages: (chatId: string) => `/chat/${chatId}/messages`,
  // 项目
  ListProjects: '/project/list',
  GetProject: (id: string) => `/project/${id}`,
  CreateProject: '/project/create',
  UpdateProject: (id: string) => `/project/${id}`,
  DeleteProject: (id: string) => `/project/${id}`,
  GetProjectChats: (projectId: string) => `/project/${projectId}/chats`,
  // 认证
  Session: '/auth/session'
}

export class QwenAPIClient {
  private accessToken: string
  private conversationId?: string
  private parentMessageId?: string
  private model?: string
  private timeoutMs: number

  constructor(options: QwenClientOptions) {
    this.accessToken = options.accessToken
    this.conversationId = options.conversationId
    this.parentMessageId = options.parentMessageId
    this.model = options.model || 'qwen-turbo'
    this.timeoutMs = options.timeoutMs || 120000
  }

  /**
   * 获取认证 token
   * 通义千问使用 JWT token
   */
  static async getAccessToken(): Promise<string> {
    const keys = ['token', 'accessToken', 'access_token', 'auth_token', 'sessionToken', 'qwen_token', 'aliyun_token']
    for (const key of keys) {
      const token = localStorage.getItem(key)
      if (token) return token
    }

    const cookies = document.cookie
    const tokenMatch = cookies.match(/(?:^|;\s*)(qwen_token|aliyun_token|access_token)=([^;]+)/)
    if (tokenMatch) return tokenMatch[2]

    throw new Error('No access token found')
  }

  /**
   * 获取用户 session
   */
  async getSession(): Promise<{ user_id: string; username: string }> {
    const response = await this.request<{ data: { user_id: string; username: string } }>(
      API_ENDPOINTS.Session,
      { method: 'GET' }
    )
    return response.data
  }

  /**
   * 发送 API 请求
   */
  private async request<T>(
    endpoint: string,
    options: {
      method?: string
      body?: object
      params?: Record<string, string>
      auth?: boolean
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, params, auth = true } = options

    let url = `${QWEN_API_BASE}${endpoint}`
    if (params) {
      const searchParams = new URLSearchParams(params)
      url += `?${searchParams.toString()}`
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }

    if (auth) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }

    const fetchOptions: RequestInit = {
      method,
      headers
    }

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body)
    }

    const response = await fetch(url, fetchOptions)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Qwen API request failed: ${response.status} - ${errorText}`)
    }

    const text = await response.text()
    if (!text) return {} as T

    return JSON.parse(text) as T
  }

  /**
   * 发送消息
   */
  async sendMessage(
    prompt: string,
    options: QwenSendMessageOptions = {}
  ): Promise<QwenSendResponse> {
    const conversationId = options.conversationId || this.conversationId
    const parentMessageId = options.parentMessageId || this.parentMessageId
    const model = options.model || this.model
    const stream = options.stream !== false

    // 构建消息
    const messages: { role: string; content: string }[] = []

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt })
    }

    messages.push({ role: 'user', content: prompt })

    const requestData = {
      model,
      messages,
      stream,
      ...(conversationId && { chat_id: conversationId }),
      ...(parentMessageId && { parent_id: parentMessageId }),
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.topP !== undefined && { top_p: options.topP }),
      ...(options.maxTokens !== undefined && { max_tokens: options.maxTokens })
    }

    if (stream) {
      return this.handleStreamRequest(requestData, conversationId)
    }

    const response = await this.request<{
      id: string
      chat_id: string
      choices: { message: { content: string } }[]
    }>(API_ENDPOINTS.SendMessage, {
      method: 'POST',
      body: requestData
    })

    return {
      text: response.choices?.[0]?.message?.content || '',
      conversationId: response.chat_id || response.id || '',
      messageId: response.id || ''
    }
  }

  /**
   * 处理流式请求
   */
  private async handleStreamRequest(
    requestData: object,
    conversationId?: string
  ): Promise<QwenSendResponse> {
    const response = await fetch(`${QWEN_API_BASE}${API_ENDPOINTS.SendMessage}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream, application/json',
        'Authorization': `Bearer ${this.accessToken}`
      },
      body: JSON.stringify(requestData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Qwen chat failed: ${response.status} - ${errorText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let fullText = ''
    let responseConversationId = conversationId || ''
    let responseMessageId = ''

    const startTime = Date.now()

    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)

          if (data === '[DONE]') {
            continue
          }

          try {
            const parsed = JSON.parse(data)

            if (parsed.id && !responseConversationId) {
              responseConversationId = parsed.chat_id || parsed.id
            }

            if (parsed.id) {
              responseMessageId = parsed.id
            }

            if (parsed.choices?.[0]?.delta?.content) {
              fullText += parsed.choices[0].delta.content
            }
          } catch {
            // 忽略解析错误
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
  async listConversations(offset = 0, limit = 20): Promise<QwenConversation[]> {
    const response = await this.request<QwenConversationListResponse>(
      API_ENDPOINTS.ListChats,
      {
        params: {
          offset: offset.toString(),
          limit: limit.toString()
        }
      }
    )

    return response.chats || []
  }

  /**
   * 获取会话详情
   */
  async getConversation(conversationId: string): Promise<QwenConversation> {
    return this.request<QwenConversation>(API_ENDPOINTS.GetChat(conversationId))
  }

  /**
   * 创建新会话
   */
  async createConversation(name?: string): Promise<QwenConversation> {
    const response = await this.request<{ chat: QwenConversation }>(
      API_ENDPOINTS.CreateChat,
      {
        method: 'POST',
        body: name ? { name } : {}
      }
    )
    return response.chat
  }

  /**
   * 更新会话 (重命名)
   */
  async updateConversation(
    conversationId: string,
    updates: { name?: string }
  ): Promise<QwenConversation> {
    const response = await this.request<{ chat: QwenConversation }>(
      API_ENDPOINTS.UpdateChat(conversationId),
      {
        method: 'PATCH',
        body: updates
      }
    )
    return response.chat
  }

  /**
   * 删除会话
   */
  async deleteConversation(conversationId: string): Promise<void> {
    await this.request(
      API_ENDPOINTS.DeleteChat(conversationId),
      { method: 'DELETE' }
    )
  }

  /**
   * 重命名会话
   */
  async renameConversation(conversationId: string, title: string): Promise<QwenConversation> {
    return this.updateConversation(conversationId, { name: title })
  }

  // ============ 消息管理 ============

  /**
   * 获取消息列表
   */
  async getMessages(
    conversationId: string,
    offset = 0,
    limit = 50
  ): Promise<QwenMessageItem[]> {
    const response = await this.request<{ messages: QwenMessageItem[] }>(
      API_ENDPOINTS.ListMessages(conversationId),
      {
        params: {
          offset: offset.toString(),
          limit: limit.toString()
        }
      }
    )

    return response.messages || []
  }

  // ============ 项目管理 ============

  /**
   * 获取项目列表
   */
  async listProjects(offset = 0, limit = 20): Promise<QwenProject[]> {
    const response = await this.request<QwenProjectListResponse>(
      API_ENDPOINTS.ListProjects,
      {
        params: {
          offset: offset.toString(),
          limit: limit.toString()
        }
      }
    )

    return response.projects || []
  }

  /**
   * 获取项目详情
   */
  async getProject(projectId: string): Promise<QwenProject> {
    return this.request<QwenProject>(API_ENDPOINTS.GetProject(projectId))
  }

  /**
   * 创建项目
   */
  async createProject(name: string, description?: string): Promise<QwenProject> {
    const response = await this.request<{ project: QwenProject }>(
      API_ENDPOINTS.CreateProject,
      {
        method: 'POST',
        body: {
          name,
          description: description || ''
        }
      }
    )
    return response.project
  }

  /**
   * 更新项目
   */
  async updateProject(
    projectId: string,
    updates: { name?: string; description?: string }
  ): Promise<QwenProject> {
    const response = await this.request<{ project: QwenProject }>(
      API_ENDPOINTS.UpdateProject(projectId),
      {
        method: 'PATCH',
        body: updates
      }
    )
    return response.project
  }

  /**
   * 删除项目
   */
  async deleteProject(projectId: string): Promise<void> {
    await this.request(
      API_ENDPOINTS.DeleteProject(projectId),
      { method: 'DELETE' }
    )
  }

  /**
   * 获取项目下的会话
   */
  async getProjectConversations(
    projectId: string,
    offset = 0,
    limit = 20
  ): Promise<QwenConversation[]> {
    const response = await this.request<QwenConversationListResponse>(
      API_ENDPOINTS.GetProjectChats(projectId),
      {
        params: {
          offset: offset.toString(),
          limit: limit.toString()
        }
      }
    )

    return response.chats || []
  }
}
