// WebSocket Client for Service Worker
// 支持断线重连、心跳和请求-响应模式

type MessageHandler = (data: unknown) => void
type VoidHandler = () => void

// 待处理的请求
interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
  timeout: NodeJS.Timeout
}

export class LocalWsClient {
  private ws: WebSocket | null = null
  private url: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private listeners: {
    open: VoidHandler[]
    message: MessageHandler[]
    close: VoidHandler[]
    error: MessageHandler[]
  } = {
    open: [],
    message: [],
    close: [],
    error: []
  }

  // 请求-响应映射
  private pendingRequests = new Map<string, PendingRequest>()

  constructor(url: string) {
    this.url = url
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          console.log('[WsClient] Connected')
          this.reconnectAttempts = 0
          this.startHeartbeat()
          this.listeners.open.forEach(handler => handler())
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)

            // 检查是否是响应消息（有 requestId）
            if (data.requestId) {
              this.handleResponse(data)
            } else {
              // 普通消息
              this.listeners.message.forEach(handler => handler(data))
            }
          } catch (e) {
            console.error('[WsClient] Failed to parse message:', e)
          }
        }

        this.ws.onclose = () => {
          console.log('[WsClient] Disconnected')
          this.stopHeartbeat()
          // 清理所有待处理请求
          this.cancelPendingRequests('Connection closed')
          this.listeners.close.forEach(handler => handler())
          this.attemptReconnect()
        }

        this.ws.onerror = (error) => {
          console.error('[WsClient] Error:', error)
          this.listeners.error.forEach(handler => handler(error))
          reject(error)
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  send(data: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    } else {
      console.warn('[WsClient] Cannot send - not connected')
    }
  }

  /**
   * 发送消息并等待响应
   */
  sendAndWait<T = unknown>(data: { type: string; requestId: string }, timeoutMs = 30000): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'))
        return
      }

      // 设置超时
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(data.requestId)
        reject(new Error(`Request ${data.requestId} timed out`))
      }, timeoutMs)

      // 存储待处理请求
      this.pendingRequests.set(data.requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout
      })

      // 发送消息
      this.ws.send(JSON.stringify(data))
    })
  }

  /**
   * 处理响应消息
   */
  private handleResponse(response: { requestId: string; success: boolean; data?: unknown; error?: string }) {
    const pending = this.pendingRequests.get(response.requestId)

    if (pending) {
      clearTimeout(pending.timeout)
      this.pendingRequests.delete(response.requestId)

      if (response.success) {
        pending.resolve(response.data)
      } else {
        pending.reject(new Error(response.error || 'Unknown error'))
      }
    } else {
      console.warn(`[WsClient] Received response for unknown requestId: ${response.requestId}`)
    }
  }

  /**
   * 取消所有待处理的请求
   */
  private cancelPendingRequests(reason: string) {
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new Error(reason))
    }
    this.pendingRequests.clear()
  }

  close(): void {
    this.stopHeartbeat()
    this.reconnectAttempts = this.maxReconnectAttempts // 阻止重连
    this.cancelPendingRequests('Client closed')
    if (this.ws) {
      this.ws.close()
    }
  }

  on(event: 'open' | 'close' | 'message' | 'error', handler: VoidHandler | MessageHandler): void {
    (this.listeners as any)[event].push(handler)
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: 'ping' })
      }
    }, 30000) // 30秒心跳
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WsClient] Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)

    console.log(`[WsClient] Attempting reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)

    setTimeout(() => {
      this.connect().catch(() => {
        // 连接失败会在 onerror 处理
      })
    }, delay)
  }
}
