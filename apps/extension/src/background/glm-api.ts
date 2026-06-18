/**
 * GLM API 客户端
 * 支持发送消息 + 会话管理
 *
 * API Base: https://chat.z.ai
 *
 * 主要 API 端点：
 * - GET  /api/v1/chats/?page=1&type=default - 列出会话
 * - POST /api/v1/chats/new - 创建新会话
 * - GET  /api/v1/chats/{id} - 获取会话详情
 * - POST /api/v1/chats/{id}/messages/batch - 获取消息列表
 * - POST /api/v2/chat/completions - 发送消息
 * - GET  /api/v1/folders/ - 文件夹列表
 * - GET  /api/v1/users/user/settings - 用户设置
 */

import { z } from 'zod'

// ============ Zod 类型定义 ============

// 消息角色
export const GLMMessageRoleSchema = z.enum(['user', 'assistant', 'system'])
export type GLMMessageRole = z.infer<typeof GLMMessageRoleSchema>

// 消息
export const GLMMessageSchema = z.object({
  role: GLMMessageRoleSchema,
  content: z.string()
})
export type GLMMessage = z.infer<typeof GLMMessageSchema>

// 会话基础
export const GLMConversationBaseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  created_at: z.number(),
  updated_at: z.number(),
  model: z.string().optional()
})
export type GLMConversationBase = z.infer<typeof GLMConversationBaseSchema>

// 会话详情
export const GLMConversationSchema = GLMConversationBaseSchema.extend({
  messages: z.array(GLMMessageSchema).optional(),
  is_archived: z.boolean().optional(),
  is_starred: z.boolean().optional(),
  is_pinned: z.boolean().optional(),
  last_message: GLMMessageSchema.optional(),
  folder_id: z.string().nullable().optional(),
  tags: z.array(z.string()).optional()
})
export type GLMConversation = z.infer<typeof GLMConversationSchema>

// 会话列表响应
export const GLMConversationListResponseSchema = z.object({
  chats: z.array(GLMConversationSchema).optional(),
  total: z.number().optional(),
  has_more: z.boolean().optional()
})
export type GLMConversationListResponse = z.infer<typeof GLMConversationListResponseSchema>

// 消息项
export const GLMMessageItemSchema = z.object({
  id: z.string(),
  role: GLMMessageRoleSchema,
  content: z.string(),
  created_at: z.number(),
  updated_at: z.number(),
  thinking: z.string().nullable().optional(),
  citations: z.array(z.any()).optional()
})
export type GLMMessageItem = z.infer<typeof GLMMessageItemSchema>

// 消息列表响应
export const GLMMessageListResponseSchema = z.object({
  messages: z.array(GLMMessageItemSchema).optional(),
  total: z.number().optional(),
  has_more: z.boolean().optional()
})
export type GLMMessageListResponse = z.infer<typeof GLMMessageListResponseSchema>

// 标签
export const GLMTagSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional()
})
export type GLMTag = z.infer<typeof GLMTagSchema>

// 文件夹
export const GLMFolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  created_at: z.number(),
  updated_at: z.number()
})
export type GLMFolder = z.infer<typeof GLMFolderSchema>

// 发送消息选项
export interface GLMSendMessageOptions {
  conversationId?: string
  parentMessageId?: string
  model?: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
  stream?: boolean
}

// 发送消息响应
export interface GLMSendResponse {
  text: string
  conversationId: string
  messageId: string
  thinking?: string
}

// 客户端选项
export interface GLMClientOptions {
  accessToken: string
  conversationId?: string
  parentMessageId?: string
  model?: string
  systemPrompt?: string
  timeoutMs?: number
}

// ============ GLM API 客户端 ============

const GLM_API_BASE = 'https://chat.z.ai'

// API 端点
const API_ENDPOINTS = {
  // 会话管理
  ListChats: '/api/v1/chats/',
  NewChat: '/api/v1/chats/new',
  GetChat: (id: string) => `/api/v1/chats/${id}`,
  UpdateChat: (id: string) => `/api/v1/chats/${id}`,
  DeleteChat: (id: string) => `/api/v1/chats/${id}`,
  PinChat: (id: string) => `/api/v1/chats/${id}/pin`,
  UnpinChat: (id: string) => `/api/v1/chats/${id}/unpin`,
  ArchiveChat: (id: string) => `/api/v1/chats/${id}/archive`,
  UnarchiveChat: (id: string) => `/api/v1/chats/${id}/unarchive`,
  // 消息
  Messages: (chatId: string) => `/api/v1/chats/${chatId}/messages`,
  MessagesBatch: (chatId: string) => `/api/v1/chats/${chatId}/messages/batch`,
  // 聊天完成
  ChatCompletions: '/api/v2/chat/completions',
  // 文件夹和标签
  Folders: '/api/v1/folders/',
  Tags: (chatId: string) => `/api/v1/chats/${chatId}/tags`,
  AllTags: '/api/v1/chats/all/tags',
  // 用户
  UserSettings: '/api/v1/users/user/settings'
}

export class GLMAPIClient {
  private accessToken: string
  private conversationId?: string
  private parentMessageId?: string
  private model?: string
  private timeoutMs: number

  constructor(options: GLMClientOptions) {
    this.accessToken = options.accessToken
    this.conversationId = options.conversationId
    this.parentMessageId = options.parentMessageId
    this.model = options.model || 'glm-5'
    this.timeoutMs = options.timeoutMs || 120000
  }

  /**
   * 获取认证 token
   * GLM 使用 JWT token，需要从 localStorage 获取
   */
  static async getAccessToken(): Promise<string> {
    // 尝试多种可能的 token 键名
    const keys = ['token', 'accessToken', 'access_token', 'auth_token', 'sessionToken', 'glm_token', 'zai_token']
    for (const key of keys) {
      const token = localStorage.getItem(key)
      if (token) return token
    }

    // 从 cookies 获取
    const cookies = document.cookie
    const tokenMatch = cookies.match(/(?:^|;\s*)(zai_token|glm_token|access_token)=([^;]+)/)
    if (tokenMatch) return tokenMatch[2]

    throw new Error('No GLM access token found')
  }

  /**
   * 生成 JWT 查询参数
   * GLM API 需要在查询参数中传递 JWT token 和其他信息
   */
  private generateAuthParams(): string {
    const timestamp = Date.now()
    const requestId = this.generateRequestId()

    // 简单的请求参数生成（实际可能需要更复杂的签名）
    const params = new URLSearchParams({
      timestamp: timestamp.toString(),
      requestId: requestId,
      version: '0.0.1',
      platform: 'web'
    })

    return params.toString()
  }

  /**
   * 生成请求 ID
   */
  private generateRequestId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * 发送 API 请求
   */
  private async apiRequest<T>(
    endpoint: string,
    options: {
      method?: string
      body?: object
      params?: Record<string, string>
      auth?: boolean
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, params, auth = true } = options

    let url = `${GLM_API_BASE}${endpoint}`
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
      throw new Error(`GLM API request failed: ${response.status} - ${errorText}`)
    }

    // 处理空响应
    const text = await response.text()
    if (!text) return {} as T

    return JSON.parse(text) as T
  }

  /**
   * 发送消息
   */
  async sendMessage(
    prompt: string,
    options: GLMSendMessageOptions = {}
  ): Promise<GLMSendResponse> {
    const conversationId = options.conversationId || this.conversationId
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
      ...(options.parentMessageId && { parent_id: options.parentMessageId }),
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.maxTokens !== undefined && { max_tokens: options.maxTokens })
    }

    // 生成认证参数
    const authParams = this.generateAuthParams()
    const url = `${GLM_API_BASE}${API_ENDPOINTS.ChatCompletions}?${authParams}&token=${encodeURIComponent(this.accessToken)}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': stream ? 'text/event-stream, application/json' : 'application/json'
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`GLM chat completion failed: ${response.status} - ${errorText}`)
    }

    if (stream) {
      return this.handleStreamResponse(response, conversationId)
    }

    const result = await response.json()
    return {
      text: result.choices?.[0]?.message?.content || '',
      conversationId: result.id || conversationId || '',
      messageId: result.id || ''
    }
  }

  /**
   * 处理流式响应
   */
  private async handleStreamResponse(
    response: Response,
    conversationId?: string
  ): Promise<GLMSendResponse> {
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let fullText = ''
    let responseConversationId = conversationId || ''
    let responseMessageId = ''
    let thinking = ''

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

            // 提取增量内容
            if (parsed.choices?.[0]?.delta?.content) {
              fullText += parsed.choices[0].delta.content
            }

            // 提取思考过程
            if (parsed.choices?.[0]?.delta?.thinking) {
              thinking += parsed.choices[0].delta.thinking
            }

            // 提取会话 ID
            if (parsed.id && !responseConversationId) {
              responseConversationId = parsed.id
            }

            if (parsed.id) {
              responseMessageId = parsed.id
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
      messageId: responseMessageId,
      thinking: thinking || undefined
    }
  }

  // ============ 会话管理 ============

  /**
   * 获取会话列表
   */
  async listConversations(page = 1, type: 'default' | 'pinned' | 'archived' = 'default'): Promise<GLMConversation[]> {
    const params: Record<string, string> = {
      page: page.toString(),
      type
    }

    const response = await this.apiRequest<GLMConversationListResponse>(
      API_ENDPOINTS.ListChats,
      { params, auth: true }
    )

    return response.chats || []
  }

  /**
   * 获取会话详情
   */
  async getConversation(conversationId: string): Promise<GLMConversation> {
    return this.apiRequest<GLMConversation>(
      API_ENDPOINTS.GetChat(conversationId),
      { auth: true }
    )
  }

  /**
   * 创建新会话
   */
  async createConversation(name?: string): Promise<GLMConversation> {
    const response = await this.apiRequest<{ chat: GLMConversation }>(
      API_ENDPOINTS.NewChat,
      {
        method: 'POST',
        body: name ? { name } : {},
        auth: true
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
  ): Promise<GLMConversation> {
    return this.apiRequest<GLMConversation>(
      API_ENDPOINTS.UpdateChat(conversationId),
      {
        method: 'PATCH',
        body: updates,
        auth: true
      }
    )
  }

  /**
   * 删除会话
   */
  async deleteConversation(conversationId: string): Promise<void> {
    await this.apiRequest(
      API_ENDPOINTS.DeleteChat(conversationId),
      { method: 'DELETE', auth: true }
    )
  }

  /**
   * 置顶会话
   */
  async pinConversation(conversationId: string): Promise<void> {
    await this.apiRequest(
      API_ENDPOINTS.PinChat(conversationId),
      { method: 'POST', auth: true }
    )
  }

  /**
   * 取消置顶
   */
  async unpinConversation(conversationId: string): Promise<void> {
    await this.apiRequest(
      API_ENDPOINTS.UnpinChat(conversationId),
      { method: 'POST', auth: true }
    )
  }

  /**
   * 归档会话
   */
  async archiveConversation(conversationId: string): Promise<void> {
    await this.apiRequest(
      API_ENDPOINTS.ArchiveChat(conversationId),
      { method: 'POST', auth: true }
    )
  }

  /**
   * 取消归档
   */
  async unarchiveConversation(conversationId: string): Promise<void> {
    await this.apiRequest(
      API_ENDPOINTS.UnarchiveChat(conversationId),
      { method: 'POST', auth: true }
    )
  }

  // ============ 消息管理 ============

  /**
   * 获取消息列表
   */
  async getMessages(
    conversationId: string,
    limit = 50,
    before?: string
  ): Promise<GLMMessageItem[]> {
    const body: Record<string, any> = { limit }

    if (before) {
      body.before = before
    }

    const response = await this.apiRequest<GLMMessageListResponse>(
      API_ENDPOINTS.MessagesBatch(conversationId),
      {
        method: 'POST',
        body,
        auth: true
      }
    )

    return response.messages || []
  }

  // ============ 文件夹管理 ============

  /**
   * 获取文件夹列表
   */
  async listFolders(): Promise<GLMFolder[]> {
    const response = await this.apiRequest<{ folders: GLMFolder[] }>(
      API_ENDPOINTS.Folders,
      { auth: true }
    )

    return response.folders || []
  }

  // ============ 标签管理 ============

  /**
   * 获取所有标签
   */
  async listTags(): Promise<GLMTag[]> {
    const response = await this.apiRequest<{ tags: GLMTag[] }>(
      API_ENDPOINTS.AllTags,
      { auth: true }
    )

    return response.tags || []
  }

  /**
   * 获取会话的标签
   */
  async getConversationTags(conversationId: string): Promise<GLMTag[]> {
    const response = await this.apiRequest<{ tags: GLMTag[] }>(
      API_ENDPOINTS.Tags(conversationId),
      { auth: true }
    )

    return response.tags || []
  }

  // ============ 用户设置 ============

  /**
   * 获取用户设置
   */
  async getUserSettings(): Promise<any> {
    return this.apiRequest(
      API_ENDPOINTS.UserSettings,
      { auth: true }
    )
  }
}
