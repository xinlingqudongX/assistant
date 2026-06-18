/**
 * DeepSeek API 客户端
 * 支持发送消息 + 会话管理
 *
 * API Base: https://chat.deepseek.com/api/v0
 * 流式 API: wss://hif-dliq.deepseek.com/query
 */

// ============ DeepSeek API 客户端 ============

const DEEPSEEK_API_BASE = 'https://chat.deepseek.com/api/v0'
const DEEPSEEK_STREAM_URL = 'wss://hif-dliq.deepseek.com/query'

export interface DeepSeekMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface DeepSeekConversationOptions {
  accessToken: string
  conversationId?: string
  parentMessageId?: string
  model?: string
  systemMessage?: string
  timeoutMs?: number
}

export interface DeepSeekResponse {
  text: string
  conversationId: string
  messageId: string
}

export interface DeepSeekSendMessageOptions {
  conversationId?: string
  parentMessageId?: string
  model?: string
  systemMessage?: string
  timeoutMs?: number
}

// ============ 会话管理相关类型 ============

export interface DeepSeekConversation {
  id: string
  title: string | null
  create_time: number
  update_time: number
  create_time_formatted?: string
  update_time_formatted?: string
}

export interface DeepSeekConversationDetail extends DeepSeekConversation {
  messages?: DeepSeekMessage[]
}

export interface DeepSeekShareResult {
  share_url: string
  share_id: string
}

// ============ 项目管理相关类型 ============

export interface DeepSeekProject {
  id: string
  name: string
  description?: string
  create_time: number
  update_time: number
}

export interface DeepSeekProjectDetail extends DeepSeekProject {
  chats?: DeepSeekConversation[]
}

export class DeepSeekAPIClient {
  private accessToken: string
  private conversationId?: string
  private parentMessageId?: string
  private model?: string
  private timeoutMs: number

  constructor(options: DeepSeekConversationOptions) {
    this.accessToken = options.accessToken
    this.conversationId = options.conversationId
    this.parentMessageId = options.parentMessageId
    this.model = options.model || 'deepseek-chat'
    this.timeoutMs = options.timeoutMs || 120000
  }

  /**
   * 获取认证 token
   * DeepSeek 使用 localStorage 存储
   */
  static async getAccessToken(): Promise<string> {
    // 从 localStorage 获取
    const keys = ['token', 'accessToken', 'access_token', 'auth_token', 'sessionToken']
    for (const key of keys) {
      const token = localStorage.getItem(key)
      if (token) return token
    }

    // 从 cookies 获取
    const cookies = document.cookie
    const tokenMatch = cookies.match(/(?:^|;\s*)token=([^;]+)/)
    if (tokenMatch) return tokenMatch[1]

    throw new Error('No access token found')
  }

  /**
   * 发送消息
   * 使用 DeepSeek 的 /api/v0/chat/completion 端点
   */
  async sendMessage(
    prompt: string,
    options: DeepSeekSendMessageOptions = {}
  ): Promise<DeepSeekResponse> {
    const conversationId = options.conversationId || this.conversationId
    const parentMessageId = options.parentMessageId || this.parentMessageId
    const model = options.model || this.model
    const systemMessage = options.systemMessage

    // 构建消息
    const messages: DeepSeekMessage[] = []

    // 添加系统消息
    if (systemMessage) {
      messages.push({ role: 'system', content: systemMessage })
    }

    // 添加当前消息
    messages.push({ role: 'user', content: prompt })

    // DeepSeek API 端点
    const endpoint = `${DEEPSEEK_API_BASE}/chat/completion`

    const startTime = Date.now()
    let fullText = ''
    let responseConversationId = conversationId || ''
    let responseMessageId = ''

    const timeoutId = setTimeout(() => {
      throw new Error('Request timeout')
    }, this.timeoutMs)

    try {
      // 如果有会话 ID，先创建会话
      if (!conversationId) {
        const sessionResp = await fetch(`${DEEPSEEK_API_BASE}/chat_session/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`
          },
          body: JSON.stringify({})
        })

        if (sessionResp.ok) {
          const sessionData = await sessionResp.json()
          responseConversationId = sessionData.id || sessionData.chat_session_id || ''
        }
      } else {
        responseConversationId = conversationId
      }

      // 发送消息
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessToken}`
        },
        body: JSON.stringify({
          chat_session_id: responseConversationId,
          model: model === 'deepseek-chat' ? 'deepseek-reasoner' : model,
          stream: true,
          messages
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Request failed: ${response.status}`)
      }

      // 处理流式响应
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

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
              const parsed = JSON.parse(data)

              if (parsed.id && !responseConversationId) {
                responseConversationId = parsed.id
              }

              if (parsed.choices?.[0]?.delta?.content) {
                fullText += parsed.choices[0].delta.content
              }

              if (parsed.id && parsed.id !== responseConversationId) {
                responseMessageId = parsed.id
              }
            } catch {
              // 忽略解析错误
            }
          }
        }

        // 检查超时
        if (Date.now() - startTime > this.timeoutMs) {
          throw new Error('Request timeout')
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
   * DeepSeek 使用 /api/v0/chat_session/list
   */
  async listConversations(offset = 0, limit = 20): Promise<DeepSeekConversation[]> {
    const response = await fetch(
      `${DEEPSEEK_API_BASE}/chat_session/list?offset=${offset}&limit=${limit}`,
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
    return data.items || data.data || []
  }

  /**
   * 获取会话详情
   */
  async getConversation(conversationId: string): Promise<DeepSeekConversationDetail> {
    const response = await fetch(`${DEEPSEEK_API_BASE}/chat_session/${conversationId}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to get conversation: ${response.status}`)
    }

    return response.json()
  }

  /**
   * 创建新会话
   */
  async createConversation(title?: string): Promise<DeepSeekConversation> {
    const response = await fetch(`${DEEPSEEK_API_BASE}/chat_session/create`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(title ? { title } : {})
    })

    if (!response.ok) {
      throw new Error(`Failed to create conversation: ${response.status}`)
    }

    return response.json()
  }

  /**
   * 更新会话 (重命名)
   */
  async updateConversation(
    conversationId: string,
    updates: { title?: string }
  ): Promise<DeepSeekConversation> {
    const response = await fetch(`${DEEPSEEK_API_BASE}/chat_session/${conversationId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    })

    if (!response.ok) {
      throw new Error(`Failed to update conversation: ${response.status}`)
    }

    return response.json()
  }

  /**
   * 删除会话
   */
  async deleteConversation(conversationId: string): Promise<void> {
    const response = await fetch(`${DEEPSEEK_API_BASE}/chat_session/${conversationId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to delete conversation: ${response.status}`)
    }
  }

  /**
   * 重命名会话
   */
  async renameConversation(conversationId: string, title: string): Promise<DeepSeekConversation> {
    return this.updateConversation(conversationId, { title })
  }

  /**
   * 获取归档会话
   */
  async getArchivedConversations(offset = 0, limit = 20): Promise<DeepSeekConversation[]> {
    const response = await fetch(
      `${DEEPSEEK_API_BASE}/chat_session/archived?offset=${offset}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to get archived conversations: ${response.status}`)
    }

    const data = await response.json()
    return data.items || data.data || []
  }

  /**
   * 归档会话
   */
  async archiveConversation(conversationId: string): Promise<void> {
    const response = await fetch(`${DEEPSEEK_API_BASE}/conversations/${conversationId}/archive`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to archive conversation: ${response.status}`)
    }
  }

  // ============ 项目管理 ============

  /**
   * 获取项目列表
   */
  async listProjects(offset = 0, limit = 20): Promise<DeepSeekProject[]> {
    const response = await fetch(
      `${DEEPSEEK_API_BASE}/projects?offset=${offset}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to list projects: ${response.status}`)
    }

    const data = await response.json()
    return data.items || []
  }

  /**
   * 获取项目详情
   */
  async getProject(projectId: string): Promise<DeepSeekProjectDetail> {
    const response = await fetch(`${DEEPSEEK_API_BASE}/projects/${projectId}`, {
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
  async createProject(name: string, description?: string): Promise<DeepSeekProject> {
    const response = await fetch(`${DEEPSEEK_API_BASE}/projects`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        description
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to create project: ${response.status}`)
    }

    return response.json()
  }

  /**
   * 更新项目
   */
  async updateProject(
    projectId: string,
    updates: { name?: string; description?: string }
  ): Promise<DeepSeekProject> {
    const response = await fetch(`${DEEPSEEK_API_BASE}/projects/${projectId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
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
    const response = await fetch(`${DEEPSEEK_API_BASE}/projects/${projectId}`, {
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
   * 获取项目下的会话
   */
  async getProjectConversations(
    projectId: string,
    offset = 0,
    limit = 20
  ): Promise<DeepSeekConversation[]> {
    const response = await fetch(
      `${DEEPSEEK_API_BASE}/projects/${projectId}/conversations?offset=${offset}&limit=${limit}`,
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
}
