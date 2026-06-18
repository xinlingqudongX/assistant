// Message Router - 协调 service worker 和 content script
// 处理来自 content script 和 NestJS service 的消息

import type { LocalWsClient } from './local-ws-client.js'
import type { TabRegistry } from './tab-registry.js'
import type { Provider, ParticipantStatus } from '@ai-council/protocol'
import type { ChatGPTAPIClient } from './chatgpt-api.js'
import type { ClaudeAPIClient } from './claude-api.js'

export interface AuthState {
  chatgpt: { authenticated: boolean; accessToken?: string }
  claude: { authenticated: boolean; accessToken?: string }
  [key: string]: { authenticated: boolean; accessToken?: string }
}

export class MessageRouter {
  private wsClient: LocalWsClient
  private tabRegistry: TabRegistry
  private chatgptClient: ChatGPTAPIClient | null = null
  private claudeClient: ClaudeAPIClient | null = null

  // 认证状态
  private authState: AuthState = {
    chatgpt: { authenticated: false },
    claude: { authenticated: false }
  }

  // 房间状态
  private roomState: {
    currentRoom?: string
    participants: string[]
  } = {
    participants: []
  }

  // 待处理的 prompt 请求
  private pendingPrompts: Map<string, {
    participantId: string
    resolve: (value: any) => void
    reject: (error: Error) => void
  }> = new Map()

  // 认证刷新回调
  private authRefreshCallbacks: Map<string, (result: any) => void> = new Map()

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

  // ============ Content Script 消息处理 ============

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

      case 'auth.refresh':
        // 处理来自 settings 页面的 auth.refresh 请求
        this.handleAuthRefreshRequest(typedMessage as {
          type: string
          provider?: string
        }).then(sendResponse)
        break

      default:
        console.warn('[Router] Unknown message type:', typedMessage.type)
    }
  }

  // ============ 服务端消息处理 ============

  handleServerMessage(data: unknown): void {
    const message = data as { type: string; requestId?: string; [key: string]: unknown }

    switch (message.type) {
      // ============ 连接状态 ============
      case 'connected':
        this.handleConnected(message as {
          type: string
          clientId: string
          timestamp: number
        })
        break

      case 'extension.pong':
        this.handleExtensionPong(message as {
          type: string
          version: string
          timestamp: number
        })
        break

      case 'pong':
        console.log('[Router] Pong received')
        break

      // ============ 认证相关 ============
      case 'auth.refreshed':
        this.handleAuthRefreshed(message as {
          type: string
          provider?: string
          success: boolean
          status?: AuthState
          error?: string
        })
        break

      case 'auth.status':
        this.handleAuthStatus(message as {
          type: string
          requestId: string
        })
        break

      case 'auth.status.result':
        this.handleAuthStatusResult(message as {
          type: string
          requestId: string
          success: boolean
          status?: AuthState
          error?: string
        })
        break

      case 'auth.refresh.result':
        this.handleAuthRefreshResult(message as {
          type: string
          requestId: string
          success: boolean
          status?: AuthState
          error?: string
        })
        break

      // ============ 决策相关 ============
      case 'decision.completed':
        this.handleDecisionCompleted(message as {
          type: string
          decisionId: string
          status: string
          task: string
          results?: Record<string, any>
          summary?: string
          consensus?: { reached: boolean; level: number }
          createdAt: number
          completedAt?: number
        })
        break

      // ============ 房间相关 ============
      case 'room.status':
        this.handleRoomStatus(message as {
          type: string
          roomId?: string
          participants?: string[]
          status?: string
        })
        break

      case 'room.created':
        this.handleRoomCreated(message as {
          type: string
          roomId: string
          name: string
        })
        break

      case 'room.joined':
        this.handleRoomJoined(message as {
          type: string
          roomId: string
          participantId: string
        })
        break

      case 'room.left':
        this.handleRoomLeft(message as {
          type: string
          roomId: string
          participantId: string
        })
        break

      case 'room.closed':
        this.handleRoomClosed(message as {
          type: string
          roomId: string
        })
        break

      // ============ 决策相关 ============
      case 'decision.distribute':
        this.handleDecisionDistribute(message as {
          type: string
          decisionId: string
          task: string
          context?: Record<string, unknown>
        })
        break

      case 'decision.collect':
        this.handleDecisionCollect(message as {
          type: string
          decisionId: string
          question: string
        })
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

      // ============ AI Prompt ============
      case 'ai.prompt.send':
        this.handlePromptSend(message as {
          type: string
          correlationId: string
          participantId: string
          payload: { role: string; prompt: string }
        })
        break

      case 'ai.prompt.result':
        this.handlePromptResult(message as {
          type: string
          correlationId: string
          success: boolean
          text?: string
          error?: string
        })
        break

      // ============ 错误处理 ============
      case 'error':
        this.handleServerError(message as {
          type: string
          code?: string
          message: string
        })
        break

      default:
        console.warn('[Router] Unknown server message:', message.type)
    }
  }

  // ============ 连接状态处理 ============

  private handleConnected(message: { clientId: string; timestamp: number }): void {
    console.log('[Router] Server connected:', message)

    // 广播状态更新到所有监听器
    this.broadcastToUI({
      type: 'connection.status',
      connected: true,
      clientId: message.clientId
    })
  }

  private handleExtensionPong(message: { version: string; timestamp: number }): void {
    console.log('[Router] Server acknowledged hello, version:', message.version)

    // 广播状态更新
    this.broadcastToUI({
      type: 'server.version',
      version: message.version
    })
  }

  // ============ 认证处理 ============

  private handleAuthRefreshRequest(message: {
    type: string
    provider?: string
  }): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const requestId = `auth_${Date.now()}`

      console.log('[Router] Handling auth.refresh request:', message.provider)

      // 保存回调
      this.authRefreshCallbacks.set(requestId, (result) => {
        resolve(result)
      })

      // 发送到服务端
      this.wsClient.send({
        type: 'auth.refresh',
        requestId,
        provider: message.provider
      })

      // 超时处理
      setTimeout(() => {
        if (this.authRefreshCallbacks.has(requestId)) {
          this.authRefreshCallbacks.delete(requestId)
          resolve({ success: false, error: 'Timeout' })
        }
      }, 30000)
    })
  }

  private handleAuthRefreshed(message: {
    provider?: string
    success: boolean
    status?: AuthState
    error?: string
  }): void {
    console.log('[Router] Auth refreshed:', message)

    // 更新认证状态
    if (message.status) {
      this.authState = message.status
    } else if (message.provider) {
      this.authState[message.provider] = {
        authenticated: message.success
      }
    }

    // 广播认证状态更新到 Settings 页面
    this.broadcastToUI({
      type: 'auth.status',
      provider: message.provider,
      success: message.success,
      authenticated: message.success,
      error: message.error,
      status: this.authState
    })

    // 触发等待的回调
    if (message.provider) {
      const callbackKey = message.provider
      const callback = this.authRefreshCallbacks.get(callbackKey)
      if (callback) {
        callback({
          success: message.success,
          provider: message.provider,
          error: message.error
        })
        this.authRefreshCallbacks.delete(callbackKey)
      }
    }
  }

  private handleAuthStatus(message: { requestId: string }): void {
    console.log('[Router] Auth status request received')

    // 发送认证状态到服务端
    this.wsClient.send({
      type: 'auth.status.result',
      requestId: message.requestId,
      status: this.authState
    })
  }

  private handleAuthStatusResult(message: {
    requestId: string
    success: boolean
    status?: AuthState
    error?: string
  }): void {
    console.log('[Router] Auth status result:', message)

    if (message.status) {
      this.authState = message.status
    }

    // 广播认证状态更新
    this.broadcastToUI({
      type: 'auth.status',
      status: this.authState,
      success: message.success,
      error: message.error
    })
  }

  private handleAuthRefreshResult(message: {
    requestId: string
    success: boolean
    status?: AuthState
    error?: string
  }): void {
    console.log('[Router] Auth refresh result:', message)

    if (message.status) {
      this.authState = message.status
    }

    // 广播认证状态更新
    this.broadcastToUI({
      type: 'auth.status',
      status: this.authState,
      success: message.success,
      error: message.error
    })

    // 触发等待的回调
    const callback = this.authRefreshCallbacks.get(message.requestId)
    if (callback) {
      callback({
        success: message.success,
        status: this.authState,
        error: message.error
      })
      this.authRefreshCallbacks.delete(message.requestId)
    }
  }

  // ============ 决策处理 ============

  private handleDecisionCompleted(message: {
    decisionId: string
    status: string
    task: string
    results?: Record<string, any>
    summary?: string
    consensus?: { reached: boolean; level: number }
    createdAt: number
    completedAt?: number
  }): void {
    console.log('[Router] Decision completed:', message.decisionId)

    // 广播决策结果到 UI
    this.broadcastToUI({
      type: 'decision.completed',
      decisionId: message.decisionId,
      status: message.status,
      task: message.task,
      results: message.results,
      summary: message.summary,
      consensus: message.consensus,
      createdAt: message.createdAt,
      completedAt: message.completedAt
    })

    // 显示通知
    this.showNotification('决策完成', message.summary || '请查看决策结果')
  }

  private showNotification(title: string, message: string): void {
    // 使用 Chrome 通知 API
    if (typeof chrome !== 'undefined' && chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title,
        message
      })
    }
  }

  // ============ 房间处理 ============

  private handleRoomStatus(message: {
    roomId?: string
    participants?: string[]
    status?: string
  }): void {
    console.log('[Router] Room status:', message)

    // 更新本地房间状态
    if (message.roomId) {
      this.roomState.currentRoom = message.roomId
    }
    if (message.participants) {
      this.roomState.participants = message.participants
    }

    // 广播房间状态更新
    this.broadcastToUI({
      type: 'room.status',
      roomId: message.roomId,
      participants: message.participants,
      status: message.status
    })
  }

  private handleRoomCreated(message: {
    roomId: string
    name: string
  }): void {
    console.log('[Router] Room created:', message)

    this.broadcastToUI({
      type: 'room.created',
      roomId: message.roomId,
      name: message.name
    })
  }

  private handleRoomJoined(message: {
    roomId: string
    participantId: string
  }): void {
    console.log('[Router] Room joined:', message)

    this.roomState.currentRoom = message.roomId
    if (!this.roomState.participants.includes(message.participantId)) {
      this.roomState.participants.push(message.participantId)
    }

    this.broadcastToUI({
      type: 'room.joined',
      roomId: message.roomId,
      participantId: message.participantId
    })
  }

  private handleRoomLeft(message: {
    roomId: string
    participantId: string
  }): void {
    console.log('[Router] Room left:', message)

    this.roomState.participants = this.roomState.participants.filter(
      p => p !== message.participantId
    )

    this.broadcastToUI({
      type: 'room.left',
      roomId: message.roomId,
      participantId: message.participantId
    })
  }

  private handleRoomClosed(message: { roomId: string }): void {
    console.log('[Router] Room closed:', message)

    if (this.roomState.currentRoom === message.roomId) {
      this.roomState.currentRoom = undefined
      this.roomState.participants = []
    }

    this.broadcastToUI({
      type: 'room.closed',
      roomId: message.roomId
    })
  }

  // ============ 决策处理 ============

  private handleDecisionDistribute(message: {
    decisionId: string
    task: string
    context?: Record<string, unknown>
  }): void {
    console.log('[Router] Decision distribute:', message)

    // 找到对应的 tab 并发送 prompt
    const participantId = this.getCurrentParticipantId()
    if (participantId) {
      const tab = this.tabRegistry.getTabByParticipantId(participantId)
      if (tab) {
        chrome.tabs.sendMessage(tab.tabId, {
          type: 'ai.prompt.execute',
          correlationId: message.decisionId,
          participantId,
          role: 'ai-council',
          prompt: message.task,
          context: message.context
        }).catch(console.error)
      }
    }

    this.broadcastToUI({
      type: 'decision.distribute',
      decisionId: message.decisionId,
      task: message.task
    })
  }

  private handleDecisionCollect(message: {
    decisionId: string
    question: string
  }): void {
    console.log('[Router] Decision collect:', message)

    // 发送收集请求，等待 AI 响应
    this.broadcastToUI({
      type: 'decision.collect',
      decisionId: message.decisionId,
      question: message.question
    })
  }

  // ============ Content Script 消息处理 ============

  private handleTabDetected(
    message: { tabId: number; provider: Provider; url: string },
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
    const pending = this.pendingPrompts.get(message.correlationId)
    if (pending) {
      pending.resolve({
        text: message.text,
        parsed: message.parsed
      })
      this.pendingPrompts.delete(message.correlationId)
    }

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
    const pending = this.pendingPrompts.get(message.correlationId)
    if (pending) {
      pending.reject(new Error(message.error.message))
      this.pendingPrompts.delete(message.correlationId)
    }

    // 发送错误给服务端
    this.wsClient.send({
      type: 'ai.response.error',
      correlationId: message.correlationId,
      participantId: message.participantId,
      error: message.error
    })
  }

  private handlePromptSend(message: {
    correlationId: string
    participantId: string
    payload: { role: string; prompt: string }
  }): void {
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

    // 发送消息给 content script
    chrome.tabs.sendMessage(tab.tabId, {
      type: 'ai.prompt.execute',
      correlationId: message.correlationId,
      participantId: message.participantId,
      role: message.payload.role,
      prompt: message.payload.prompt
    }).catch((error) => {
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
    })
  }

  private handlePromptResult(message: {
    correlationId: string
    success: boolean
    text?: string
    error?: string
  }): void {
    const pending = this.pendingPrompts.get(message.correlationId)
    if (pending) {
      if (message.success) {
        pending.resolve({ text: message.text })
      } else {
        pending.reject(new Error(message.error || 'Unknown error'))
      }
      this.pendingPrompts.delete(message.correlationId)
    }

    this.wsClient.send({
      type: 'ai.response.done',
      correlationId: message.correlationId,
      participantId: pending?.participantId,
      payload: {
        text: message.text,
        success: message.success
      }
    })
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

  // ============ 错误处理 ============

  private handleServerError(message: {
    code?: string
    message: string
  }): void {
    console.error('[Router] Server error:', message)

    // 广播错误到 UI
    this.broadcastToUI({
      type: 'error',
      code: message.code,
      message: message.message
    })
  }

  // ============ 辅助方法 ============

  /**
   * 广播消息到 UI（popup, options page）
   */
  private broadcastToUI(message: unknown): void {
    chrome.runtime.sendMessage(message).catch(() => {
      // 忽略发送失败（可能没有 UI 页面打开）
    })
  }

  /**
   * 获取当前参与者 ID
   */
  private getCurrentParticipantId(): string | undefined {
    const tabs = this.tabRegistry.getAllTabs()
    if (tabs.length > 0) {
      return tabs[0].participantId
    }
    return undefined
  }

  /**
   * 获取认证状态
   */
  getAuthState(): AuthState {
    return this.authState
  }

  /**
   * 获取房间状态
   */
  getRoomState(): { currentRoom?: string; participants: string[] } {
    return this.roomState
  }
}
