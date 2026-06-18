/**
 * Claude API 客户端
 * 使用 accessToken 调用 Claude AI API
 * 支持发送消息 + 会话管理 + 项目管理
 *
 * API Base: https://claude.ai/api/v1
 */

export interface ClaudeMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ClaudeConversationOptions {
  accessToken: string
  conversationId?: string
  parentMessageId?: string
  model?: string
  systemPrompt?: string
  timeoutMs?: number
}

export interface ClaudeResponse {
  text: string
  conversationId: string
  messageId: string
}

export interface ClaudeSendMessageOptions {
  conversationId?: string
  parentMessageId?: string
  model?: string
  systemPrompt?: string
  timeoutMs?: number
}

// ============ 会话管理相关类型 ============

export interface ClaudeConversation {
  id: string
  name: string | null
  created_at: number
  updated_at: number
  chat_mode?: string
  model?: string
}

export interface ClaudeConversationDetail extends ClaudeConversation {
  messages?: ClaudeMessage[]
}

export interface ClaudeShareResult {
  share_url: string
  share_id: string
}

// ============ 项目管理相关类型 ============

export interface ClaudeProject {
  id: string
  name: string
  description?: string
  created_at: number
  updated_at: number
  is_default?: boolean
}

export interface ClaudeProjectDetail extends ClaudeProject {
  chats?: ClaudeConversation[]
}

// Claude API 端点
const CLAUDE_API_URL = 'https://claude.ai/api/v1'
const CLAUDE_SESSION_URL = 'https://claude.ai/api/auth/session'

// 生成 UUID v4
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export class ClaudeAPIClient {
  private accessToken: string

  constructor(options: ClaudeConversationOptions) {
    this.accessToken = options.accessToken
  }

  /**
   * 从 Chrome cookies 获取 accessToken
   */
  static async getAccessTokenFromCookies(): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.cookies.get(
        {
          url: 'https://claude.ai',
          name: 'sessionKey'
        },
        (cookie) => {
          if (cookie?.value) {
            resolve(cookie.value)
          } else {
            // 尝试其他 cookie 名称
            chrome.cookies.get(
              {
                url: 'https://claude.ai',
                name: 'auth_token'
              },
              (cookie2) => {
                if (cookie2?.value) {
                  resolve(cookie2.value)
                } else {
                  reject(new Error('Claude access token not found in cookies'))
                }
              }
            )
          }
        }
      )
    })
  }

  /**
   * 从 session API 获取 accessToken
   */
  static async fetchAccessToken(): Promise<string> {
    try {
      const response = await fetch(CLAUDE_SESSION_URL, {
        credentials: 'include'
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      if (data.token) {
        return data.token
      }
      throw new Error('No token in response')
    } catch (error) {
      console.error('[Claude] Failed to fetch accessToken:', error)
      throw error
    }
  }

  /**
   * 发送消息并获取回复（流式）
   */
  async sendMessage(
    prompt: string,
    options: ClaudeSendMessageOptions = {},
    onProgress?: (text: string) => void
  ): Promise<ClaudeResponse> {
    const {
      conversationId,
      parentMessageId,
      model = 'claude-3-5-sonnet-20240620',
      systemPrompt = 'You are Claude, a helpful AI assistant.',
      timeoutMs = 120000
    } = options

    const conversationId_ = conversationId || ''
    const messageId = uuidv4()
    const parentMessageId_ = parentMessageId || ''

    const body = {
      prompt: prompt,
      model: model,
      systemPrompt: systemPrompt,
      ...(conversationId_ && { conversationId: conversationId_ }),
      ...(parentMessageId_ && { parentMessageId: parentMessageId_ }),
      stream: true
    }

    let fullText = ''
    let responseConversationId = conversationId_
    let responseMessageId = ''

    // 创建 AbortController 用于超时
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(`${CLAUDE_API_URL}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      // 处理流式响应
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
            try {
              const parsed = JSON.parse(data)
              if (parsed.completion) {
                fullText = parsed.completion
                onProgress?.(parsed.completion)
              }
              if (parsed.conversationId) {
                responseConversationId = parsed.conversationId
              }
              if (parsed.messageId) {
                responseMessageId = parsed.messageId
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
        messageId: responseMessageId || messageId
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * 刷新 accessToken
   */
  async refreshAccessToken(): Promise<string> {
    this.accessToken = await ClaudeAPIClient.fetchAccessToken()
    return this.accessToken
  }
}
