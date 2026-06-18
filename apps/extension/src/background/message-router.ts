// Message Router - 协调 service worker 和 content script
// 处理来自 content script 和 NestJS service 的消息

import type { LocalWsClient } from './local-ws-client.js'
import type { TabRegistry } from './tab-registry.js'
import type { Provider, ParticipantStatus } from '@ai-council/protocol'
import type { ChatGPTAPIClient } from './chatgpt-api.js'
import type { ClaudeAPIClient } from './claude-api.js'

export class MessageRouter {
  private wsClient: LocalWsClient
  private tabRegistry: TabRegistry
  private chatgptClient: ChatGPTAPIClient | null = null
  private claudeClient: ClaudeAPIClient | null = null

  // 待处理的 prompt 请求
  private pendingPrompts: Map<string, {
    participantId: string
    resolve: () => void
    reject: (error: Error) => void
  }> = new Map()

  constructor(
    wsClient: LocalWsClient,
    tabRegistry: TabRegistry,
    chatgptClient?: ChatGPTAPIClient,
    claudeClient?: ClaudeAPIClient
  ) {
    this.wsClient = wsClient
    this.tabRegistry = tabRegistry
    this.chatgptClient = chatgptClient || null
    this.claudeClient = claudeClient || null
  }

  setChatGPTClient(client: ChatGPTAPIClient) {
    this.chatgptClient = client
  }

  setClaudeClient(client: ClaudeAPIClient) {
    this.claudeClient = client
  }

  handleContentMessage(
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ): void {
    const typedMessage = message as { type: string; [key: string]: unknown }

    switch (typedMessage.type) {
      case 'ai.tab.detected':
        this.handleTabDetected(typedMessage as {
          type: string
          tabId: number
          provider: Provider
          url: string
        }, sender, sendResponse)
        break

      case 'ai.status.update':
        this.handleStatusUpdate(typedMessage as {
          type: string
          participantId: string
          status: ParticipantStatus
        })
        sendResponse({ success: true })
        break

      case 'ai.response.ready':
        this.handleResponseReady(typedMessage as {
          type: string
          correlationId: string
          participantId: string
          text: string
          parsed?: unknown
        })
        sendResponse({ success: true })
        break

      case 'ai.response.error':
        this.handleResponseError(typedMessage as {
          type: string
          correlationId: string
          participantId: string
          error: { code: string; message: string }
        })
        sendResponse({ success: true })
        break

      default:
        console.warn('[Router] Unknown message type:', typedMessage.type)
    }
  }

  handleServerMessage(data: unknown): void {
    const message = data as { type: string; requestId?: string; [key: string]: unknown }

    switch (message.type) {
      case 'extension.pong':
        console.log('[Router] Server acknowledged hello')
        break

      case 'ai.prompt.send':
        this.handlePromptSend(message as {
          type: string
          correlationId: string
          participantId: string
          payload: { role: string; prompt: string }
        })
        break

      case 'room.status':
        console.log('[Router] Room status:', message)
        break

      // ============ 会话管理请求 ============
      case 'conversation.list':
        this.handleConversationList(message as {
          type: string
          requestId: string
          provider: Provider
          offset?: number
          limit?: number
        })
        break

      case 'conversation.get':
        this.handleConversationGet(message as {
          type: string
          requestId: string
          provider: Provider
          conversationId: string
        })
        break

      case 'conversation.delete':
        this.handleConversationDelete(message as {
          type: string
          requestId: string
          provider: Provider
          conversationId: string
        })
        break

      case 'conversation.rename':
        this.handleConversationRename(message as {
          type: string
          requestId: string
          provider: Provider
          conversationId: string
          title: string
        })
        break

      case 'conversation.share':
        this.handleConversationShare(message as {
          type: string
          requestId: string
          provider: Provider
          conversationId: string
          shareWith?: string
          title?: string
        })
        break

      // ============ 认证请求 ============
      case 'auth.status':
        this.handleAuthStatus(message as {
          type: string
          requestId: string
        })
        break

      case 'auth.refresh':
        this.handleAuthRefresh(message as {
          type: string
          requestId: string
          provider?: Provider
        })
        break

      case 'error':
        console.error('[Router] Server error:', message)
        break

      default:
        console.warn('[Router] Unknown server message:', message.type)
    }
  }

  // ============ Content Script 消息处理 ============

  private handleTabDetected(
    message: { type: string; tabId: number; provider: Provider; url: string },
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ): void {
    const participantId = `${message.provider}-${message.tabId}`

    // 注册 tab
    this.tabRegistry.registerTab(message.tabId, message.provider, participantId)

    // 通知服务端
    this.wsClient.send({
      type: 'ai.tab.register',
      participantId,
      provider: message.provider,
      tabId: message.tabId,
      url: message.url,
      status: 'ready'
    })

    sendResponse({
      success: true,
      participantId
    })
  }

  private handleStatusUpdate(message: {
    participantId: string
    status: ParticipantStatus
  }): void {
    this.wsClient.send({
      type: 'ai.tab.status',
      participantId: message.participantId,
      status: message.status
    })
  }

  private handleResponseReady(message: {
    correlationId: string
    participantId: string
    text: string
    parsed?: unknown
  }): void {
    // 移除待处理记录
    this.pendingPrompts.delete(message.correlationId)

    // 发送响应给服务端
    this.wsClient.send({
      type: 'ai.response.done',
      correlationId: message.correlationId,
      participantId: message.participantId,
      payload: {
        text: message.text,
        parsed: message.parsed
      }
    })
  }

  private handleResponseError(message: {
    correlationId: string
    participantId: string
    error: { code: string; message: string }
  }): void {
    // 移除待处理记录
    this.pendingPrompts.delete(message.correlationId)

    // 发送错误给服务端
    this.wsClient.send({
      type: 'ai.response.error',
      correlationId: message.correlationId,
      participantId: message.participantId,
      error: message.error
    })
  }

  private async handlePromptSend(message: {
    correlationId: string
    participantId: string
    payload: { role: string; prompt: string }
  }): Promise<void> {
    // 找到对应的 tab
    const tab = this.tabRegistry.getTabByParticipantId(message.participantId)

    if (!tab) {
      this.wsClient.send({
        type: 'ai.response.error',
        correlationId: message.correlationId,
        participantId: message.participantId,
        error: {
          code: 'TAB_NOT_FOUND',
          message: 'Target tab not found'
        }
      })
      return
    }

    // 记录待处理的 prompt
    this.pendingPrompts.set(message.correlationId, {
      participantId: message.participantId,
      resolve: () => {},
      reject: () => {}
    })

    try {
      // 发送消息给 content script
      await chrome.tabs.sendMessage(tab.tabId, {
        type: 'ai.prompt.execute',
        correlationId: message.correlationId,
        participantId: message.participantId,
        role: message.payload.role,
        prompt: message.payload.prompt
      })

      // Content script 会通过 ai.response.ready 消息返回结果
    } catch (error) {
      // Tab 可能已关闭或不可访问
      this.wsClient.send({
        type: 'ai.response.error',
        correlationId: message.correlationId,
        participantId: message.participantId,
        error: {
          code: 'TAB_ERROR',
          message: String(error)
        }
      })
    }
  }

  // ============ 会话管理处理 ============

  private async handleConversationList(message: {
    requestId: string
    provider: Provider
    offset?: number
    limit?: number
  }): Promise<void> {
    try {
      if (message.provider === 'chatgpt' && this.chatgptClient) {
        const conversations = await this.chatgptClient.listConversations(
          message.offset || 0,
          message.limit || 20
        )
        this.wsClient.send({
          type: 'conversation.list.result',
          requestId: message.requestId,
          success: true,
          conversations
        })
      } else if (message.provider === 'claude' && this.claudeClient) {
        // Claude 暂时不支持列表
        this.wsClient.send({
          type: 'conversation.list.result',
          requestId: message.requestId,
          success: false,
          error: 'Claude does not support conversation listing'
        })
      } else {
        this.wsClient.send({
          type: 'conversation.list.result',
          requestId: message.requestId,
          success: false,
          error: 'Provider not initialized'
        })
      }
    } catch (error) {
      this.wsClient.send({
        type: 'conversation.list.result',
        requestId: message.requestId,
        success: false,
        error: String(error)
      })
    }
  }

  private async handleConversationGet(message: {
    requestId: string
    provider: Provider
    conversationId: string
  }): Promise<void> {
    try {
      if (message.provider === 'chatgpt' && this.chatgptClient) {
        const conversation = await this.chatgptClient.getConversation(message.conversationId)
        this.wsClient.send({
          type: 'conversation.get.result',
          requestId: message.requestId,
          success: true,
          conversation
        })
      } else {
        this.wsClient.send({
          type: 'conversation.get.result',
          requestId: message.requestId,
          success: false,
          error: 'Provider not initialized'
        })
      }
    } catch (error) {
      this.wsClient.send({
        type: 'conversation.get.result',
        requestId: message.requestId,
        success: false,
        error: String(error)
      })
    }
  }

  private async handleConversationDelete(message: {
    requestId: string
    provider: Provider
    conversationId: string
  }): Promise<void> {
    try {
      if (message.provider === 'chatgpt' && this.chatgptClient) {
        await this.chatgptClient.deleteConversation(message.conversationId)
        this.wsClient.send({
          type: 'conversation.delete.result',
          requestId: message.requestId,
          success: true,
          deleted: true
        })
      } else {
        this.wsClient.send({
          type: 'conversation.delete.result',
          requestId: message.requestId,
          success: false,
          error: 'Provider not initialized'
        })
      }
    } catch (error) {
      this.wsClient.send({
        type: 'conversation.delete.result',
        requestId: message.requestId,
        success: false,
        error: String(error)
      })
    }
  }

  private async handleConversationRename(message: {
    requestId: string
    provider: Provider
    conversationId: string
    title: string
  }): Promise<void> {
    try {
      if (message.provider === 'chatgpt' && this.chatgptClient) {
        await this.chatgptClient.renameConversation(message.conversationId, message.title)
        this.wsClient.send({
          type: 'conversation.rename.result',
          requestId: message.requestId,
          success: true,
          renamed: true
        })
      } else {
        this.wsClient.send({
          type: 'conversation.rename.result',
          requestId: message.requestId,
          success: false,
          error: 'Provider not initialized'
        })
      }
    } catch (error) {
      this.wsClient.send({
        type: 'conversation.rename.result',
        requestId: message.requestId,
        success: false,
        error: String(error)
      })
    }
  }

  private async handleConversationShare(message: {
    requestId: string
    provider: Provider
    conversationId: string
    shareWith?: string
    title?: string
  }): Promise<void> {
    try {
      if (message.provider === 'chatgpt' && this.chatgptClient) {
        const result = await this.chatgptClient.shareConversation({
          conversationId: message.conversationId,
          shareWith: message.shareWith as 'public' | 'link_only' | 'private' || 'public',
          title: message.title
        })
        this.wsClient.send({
          type: 'conversation.share.result',
          requestId: message.requestId,
          success: true,
          shareResult: result
        })
      } else {
        this.wsClient.send({
          type: 'conversation.share.result',
          requestId: message.requestId,
          success: false,
          error: 'Provider not initialized'
        })
      }
    } catch (error) {
      this.wsClient.send({
        type: 'conversation.share.result',
        requestId: message.requestId,
        success: false,
        error: String(error)
      })
    }
  }

  // ============ 认证处理 ============

  private async handleAuthStatus(message: {
    requestId: string
  }): Promise<void> {
    try {
      let chatgptAuth = { authenticated: false }
      let claudeAuth = { authenticated: false }

      try {
        const chatgptToken = await ChatGPTAPIClient.getAccessTokenFromCookies()
        chatgptAuth = { authenticated: true, accessToken: chatgptToken.slice(0, 20) + '...' }
      } catch {
        // 未认证
      }

      try {
        const claudeToken = await ClaudeAPIClient.getAccessTokenFromCookies()
        claudeAuth = { authenticated: true, accessToken: claudeToken.slice(0, 20) + '...' }
      } catch {
        // 未认证
      }

      this.wsClient.send({
        type: 'auth.status.result',
        requestId: message.requestId,
        success: true,
        status: {
          chatgpt: chatgptAuth,
          claude: claudeAuth
        }
      })
    } catch (error) {
      this.wsClient.send({
        type: 'auth.status.result',
        requestId: message.requestId,
        success: false,
        error: String(error)
      })
    }
  }

  private async handleAuthRefresh(message: {
    requestId: string
    provider?: Provider
  }): Promise<void> {
    try {
      let chatgptAuth = { authenticated: false }
      let claudeAuth = { authenticated: false }

      // 刷新 ChatGPT token
      if (!message.provider || message.provider === 'chatgpt') {
        try {
          const chatgptToken = await ChatGPTAPIClient.fetchAccessToken()
          this.chatgptClient?.setAccessToken(chatgptToken)
          chatgptAuth = { authenticated: true, accessToken: chatgptToken.slice(0, 20) + '...' }
        } catch {
          // 刷新失败
        }
      }

      // 刷新 Claude token
      if (!message.provider || message.provider === 'claude') {
        try {
          const claudeToken = await ClaudeAPIClient.fetchAccessToken()
          this.claudeClient = new ClaudeAPIClient({ accessToken: claudeToken })
          claudeAuth = { authenticated: true, accessToken: claudeToken.slice(0, 20) + '...' }
        } catch {
          // 刷新失败
        }
      }

      this.wsClient.send({
        type: 'auth.refresh.result',
        requestId: message.requestId,
        success: true,
        status: {
          chatgpt: chatgptAuth,
          claude: claudeAuth
        }
      })
    } catch (error) {
      this.wsClient.send({
        type: 'auth.refresh.result',
        requestId: message.requestId,
        success: false,
        error: String(error)
      })
    }
  }
}
