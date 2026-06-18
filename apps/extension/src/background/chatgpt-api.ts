/**
 * ChatGPT API 客户端
 * 支持发送消息 + 会话管理（列表/详情/删除/重命名/共享）
 * 
 * 使用 accessToken 通过 ChatGPT 后端 API 调用
 * 参考: https://github.com/transitive-bullshit/chatgpt-api
 */

export interface ChatGPTMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatGPTConversationOptions {
  accessToken: string
  conversationId?: string
  parentMessageId?: string
  model?: string
  systemMessage?: string
  timeoutMs?: number
}

export interface ChatGPTResponse {
  text: string
  conversationId: string
  messageId: string
}

export interface ChatGPTSendMessageOptions {
  conversationId?: string
  parentMessageId?: string
  model?: string
  systemMessage?: string
  timeoutMs?: number
}

// ============ 会话管理相关类型 ============

export interface ChatGPTConversation {
  id: string
  title: string | null
  create_time: number
  update_time: number
  create_time_formatted?: string
  update_time_formatted?: string
}

export interface ChatGPTProject {
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

export interface CreateProjectOptions {
  name: string
  description?: string
}

export interface UpdateProjectOptions {
  name?: string
  description?: string
}

export interface ShareProjectOptions {
  projectId: string
  shareWith?: 'public' | 'link_only' | 'private'
  shareTitle?: string
}

export interface ShareProjectResult {
  share_url: string
  share_id: string
}

export interface ChatGPTConversationDetail extends ChatGPTConversation {
  mapping: Record<string, MessageNode>
  moderation_results: unknown[]
  has_summarization?: boolean
}

export interface MessageNode {
  id: string
  message?: {
    id: string
    author: { role: string; name?: string }
    create_time?: number
    update_time?: number
    content: {
      content_type: string
      parts?: string[]
      text?: string
    }
    status: string
    end_turn?: boolean
    metadata?: Record<string, unknown>
  }
  children: string[]
  parent?: string
}

export interface ShareConversationOptions {
  conversationId: string
  shareWith: 'public' | 'link_only' | 'private'
  title?: string
}

export interface ShareConversationResult {
  share_url: string
  share_id: string
}

// ============ 常量 ============

const CHATGPT_API_BASE = 'https://chatgpt.com/backend-api'
const CHATGPT_CONVERSATION_URL = 'https://chatgpt.com/api/conversation'
const SESSION_URL = 'https://chatgpt.com/api/auth/session'

// 生成 UUID v4
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export class ChatGPTAPIClient {
  private accessToken: string

  constructor(options: ChatGPTConversationOptions) {
    this.accessToken = options.accessToken
  }

  // ============ Token 管理 ============

  /**
   * 从 Chrome cookies 获取 accessToken
   */
  static async getAccessTokenFromCookies(): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.cookies.get(
        {
          url: 'https://chatgpt.com',
          name: '__Secure-next-auth.session-token'
        },
        (cookie) => {
          if (cookie?.value) {
            resolve(cookie.value)
          } else {
            // 尝试备用 cookie
            chrome.cookies.get(
              {
                url: 'https://chatgpt.com',
                name: 'access_token'
              },
              (cookie2) => {
                if (cookie2?.value) {
                  resolve(cookie2.value)
                } else {
                  reject(new Error('Access token not found in cookies'))
                }
              }
            )
          }
        }
      )
    })
  }

  /**
   * 从 session API 获取 accessToken (background script 可以调用)
   */
  static async fetchAccessToken(): Promise<string> {
    try {
      const response = await fetch(SESSION_URL, {
        credentials: 'include'
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      if (data.accessToken) {
        return data.accessToken
      }
      throw new Error('No accessToken in response')
    } catch (error) {
      console.error('[ChatGPT] Failed to fetch accessToken:', error)
      throw error
    }
  }

  // ============ 发送消息 ============

  /**
   * 发送消息并获取回复（流式）
   */
  async sendMessage(
    prompt: string,
    options: ChatGPTSendMessageOptions = {},
    onProgress?: (text: string) => void
  ): Promise<ChatGPTResponse> {
    const {
      conversationId,
      parentMessageId,
      model = 'text-davinci-002-render-sha',
      systemMessage = 'You are ChatGPT, a large language model trained by OpenAI.',
      timeoutMs = 120000
    } = options

    const conversationId_ = conversationId || uuidv4()
    const messageId = uuidv4()
    const parentMessageId_ = parentMessageId || uuidv4()

    const messages: ChatGPTMessage[] = []

    if (systemMessage) {
      messages.push({
        id: uuidv4(),
        role: 'system',
        content: systemMessage
      })
    }

    messages.push({
      id: messageId,
      role: 'user',
      content: prompt
    })

    const body = {
      action: 'next',
      messages: messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        author: { role: msg.role }
      })),
      conversation_id: conversationId || null,
      parent_message_id: parentMessageId_,
      model,
      history_and_training_disabled: false
    }

    let fullText = ''
    let responseConversationId = conversationId_
    let responseMessageId = ''

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      // 直接调用 ChatGPT API，不需要代理
      const response = await fetch(CHATGPT_CONVERSATION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
          'OpenAI-Conversation-Id-Opt-In': 'true',
          'OpenAI-Organization': ''
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              if (parsed.message?.content?.parts) {
                const part = parsed.message.content.parts[0]
                if (part !== fullText) {
                  fullText = part
                  onProgress?.(part)
                }
              }
              if (parsed.conversation_id) {
                responseConversationId = parsed.conversation_id
              }
              if (parsed.message?.id) {
                responseMessageId = parsed.message.id
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      return {
        text: fullText,
        conversationId: responseConversationId,
        messageId: responseMessageId
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // ============ 会话管理 ============

  /**
   * 获取会话列表
   */
  async listConversations(offset = 0, limit = 20): Promise<ChatGPTConversation[]> {
    const response = await fetch(
      `${CHATGPT_API_BASE}/conversations?offset=${offset}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to list conversations: ${response.status}`)
    }

    const data = await response.json()
    return data.items || []
  }

  /**
   * 获取单个会话详情
   */
  async getConversation(conversationId: string): Promise<ChatGPTConversationDetail> {
    const response = await fetch(
      `${CHATGPT_API_BASE}/conversation/${conversationId}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to get conversation: ${response.status}`)
    }

    return response.json()
  }

  /**
   * 删除会话
   */
  async deleteConversation(conversationId: string): Promise<void> {
    const response = await fetch(
      `${CHATGPT_API_BASE}/conversation/${conversationId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_visible: false })
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to delete conversation: ${response.status}`)
    }
  }

  /**
   * 重命名会话标题
   */
  async renameConversation(
    conversationId: string,
    title: string
  ): Promise<void> {
    const response = await fetch(
      `${CHATGPT_API_BASE}/conversation/${conversationId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title })
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to rename conversation: ${response.status}`)
    }
  }

  /**
   * 共享会话
   */
  async shareConversation(
    options: ShareConversationOptions
  ): Promise<ShareConversationResult> {
    const { conversationId, shareWith = 'public', title } = options

    const response = await fetch(`${CHATGPT_API_BASE}/share/create`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        share_with: shareWith,
        title: title || null
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to share conversation: ${response.status}`)
    }

    const data = await response.json()
    return {
      share_url: data.share_url || `https://chatgpt.com/share/${data.share_id}`,
      share_id: data.share_id
    }
  }

  /**
   * 刷新 accessToken
   */
  async refreshAccessToken(): Promise<string> {
    this.accessToken = await ChatGPTAPIClient.fetchAccessToken()
    return this.accessToken
  }

  /**
   * 更新 accessToken
   */
  setAccessToken(token: string): void {
    this.accessToken = token
  }

  // ============ 项目管理 ============

  /**
   * 获取项目列表
   */
  async listProjects(options?: {
    offset?: number
    limit?: number
    filter?: 'all' | 'owned' | 'shared'
  }): Promise<ChatGPTProject[]> {
    const { offset = 0, limit = 20, filter = 'all' } = options || {}

    let url = `${CHATGPT_API_BASE}/projects?offset=${offset}&limit=${limit}`
    if (filter === 'owned') {
      url += '&owned_only=true'
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to list projects: ${response.status}`)
    }

    const data = await response.json()
    return data.items || data.projects || []
  }

  /**
   * 获取单个项目详情
   */
  async getProject(projectId: string): Promise<ChatGPTProject> {
    const response = await fetch(`${CHATGPT_API_BASE}/projects/${projectId}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to get project: ${response.status}`)
    }

    return response.json()
  }

  /**
   * 创建项目
   */
  async createProject(options: CreateProjectOptions): Promise<ChatGPTProject> {
    const { name, description, visibility = 'private' } = options

    const response = await fetch(`${CHATGPT_API_BASE}/projects`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        description: description || '',
        visibility
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to create project: ${response.status} - ${errorText}`)
    }

    return response.json()
  }

  /**
   * 更新项目
   */
  async updateProject(projectId: string, options: UpdateProjectOptions): Promise<ChatGPTProject> {
    const response = await fetch(`${CHATGPT_API_BASE}/projects/${projectId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(options)
    })

    if (!response.ok) {
      throw new Error(`Failed to update project: ${response.status}`)
    }

    return response.json()
  }

  /**
   * 删除项目
   */
  async deleteProject(projectId: string): Promise<void> {
    const response = await fetch(`${CHATGPT_API_BASE}/projects/${projectId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to delete project: ${response.status}`)
    }
  }

  /**
   * 共享项目
   */
  async shareProject(options: ShareProjectOptions): Promise<ShareProjectResult> {
    const { projectId, shareWith = 'private', title } = options

    const response = await fetch(`${CHATGPT_API_BASE}/projects/${projectId}/share`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        share_with: shareWith,
        title: title || null
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to share project: ${response.status}`)
    }

    const data = await response.json()
    return {
      share_url: data.share_url || `https://chatgpt.com/projects/${data.share_id}`,
      share_id: data.share_id
    }
  }

  /**
   * 获取项目的会话列表
   */
  async getProjectConversations(projectId: string, offset = 0, limit = 20): Promise<ChatGPTConversation[]> {
    const response = await fetch(
      `${CHATGPT_API_BASE}/projects/${projectId}/conversations?offset=${offset}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to get project conversations: ${response.status}`)
    }

    const data = await response.json()
    return data.items || []
  }

  /**
   * 将会话添加到项目
   */
  async addConversationToProject(projectId: string, conversationId: string): Promise<void> {
    const response = await fetch(`${CHATGPT_API_BASE}/projects/${projectId}/conversations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ conversation_id: conversationId })
    })

    if (!response.ok) {
      throw new Error(`Failed to add conversation to project: ${response.status}`)
    }
  }

  /**
   * 从项目移除会话
   */
  async removeConversationFromProject(projectId: string, conversationId: string): Promise<void> {
    const response = await fetch(
      `${CHATGPT_API_BASE}/projects/${projectId}/conversations/${conversationId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to remove conversation from project: ${response.status}`)
    }
  }
}
