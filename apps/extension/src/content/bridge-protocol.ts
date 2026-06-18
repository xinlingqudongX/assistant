// Bridge Protocol - Content Script 与 Background 通信的协议层

import type { Provider, Message } from '@ai-council/protocol'

// ============ Bridge Message ============

export interface BridgeMessage {
  type: string
  provider?: Provider
  correlationId?: string
  participantId?: string
  payload?: unknown
  [key: string]: unknown
}

// ============ Bridge Protocol ============

export class BridgeProtocol {
  private static messageQueue: BridgeMessage[] = []
  private static isConnected = false

  /**
   * 初始化 Bridge
   */
  static initialize(): void {
    // 监听 background 的消息
    chrome.runtime.onMessage.addListener((message) => {
      this.handleMessage(message)
    })

    // 尝试连接
    this.connect()
  }

  /**
   * 连接到 background
   */
  static connect(): void {
    // 发送 ping 消息测试连接
    chrome.runtime.sendMessage(
      { type: 'bridge.ping' },
      (response) => {
        if (response?.type === 'bridge.pong') {
          this.isConnected = true
          this.flushQueue()
        }
      }
    )
  }

  /**
   * 发送消息
   */
  static sendMessage(message: BridgeMessage): void {
    if (this.isConnected) {
      chrome.runtime.sendMessage(message)
    } else {
      // 队列消息，稍后发送
      this.messageQueue.push(message)
      this.connect()
    }
  }

  /**
   * 处理接收到的消息
   */
  private static handleMessage(message: BridgeMessage): void {
    switch (message.type) {
      case 'bridge.pong':
        this.isConnected = true
        this.flushQueue()
        break

      case 'ai.prompt.execute':
        // 由 content script 主入口处理
        window.postMessage(
          { ...message, source: 'bridge' },
          window.location.origin
        )
        break

      case 'ai.status.query':
        // 返回当前状态
        this.sendMessage({
          type: 'ai.status.response',
          status: {
            provider: this.getCurrentProvider(),
            url: window.location.href
          }
        })
        break

      default:
        // 转发给内容处理
        window.postMessage(
          { ...message, source: 'bridge' },
          window.location.origin
        )
    }
  }

  /**
   * 清空消息队列
   */
  private static flushQueue(): void {
    for (const message of this.messageQueue) {
      chrome.runtime.sendMessage(message)
    }
    this.messageQueue = []
  }

  /**
   * 获取当前 AI provider
   */
  private static getCurrentProvider(): Provider | null {
    const url = window.location.href

    if (url.includes('chatgpt.com')) return 'chatgpt'
    if (url.includes('claude.ai')) return 'claude'
    if (url.includes('kimi.com')) return 'kimi'
    if (url.includes('deepseek.com')) return 'deepseek'
    if (url.includes('qianwen.aliyun.com')) return 'qwen'
    if (url.includes('chat.z.ai')) return 'glm'

    return null
  }

  /**
   * 监听 window 消息（来自 bridge）
   */
  static onWindowMessage(handler: (message: BridgeMessage) => void): void {
    window.addEventListener('message', (event) => {
      // 只处理来自 bridge 的消息
      if (event.data?.source === 'bridge') {
        handler(event.data as BridgeMessage)
      }
    })
  }
}
