// Service Worker 入口
// 管理 WebSocket 连接、消息路由和 API 客户端

import { LocalWsClient } from './local-ws-client.js'
import { TabRegistry } from './tab-registry.js'
import { MessageRouter } from './message-router.js'
import { ChatGPTAPIClient } from './chatgpt-api.js'
import { ClaudeAPIClient } from './claude-api.js'

// ============ 类型定义 ============

export interface ExtensionConfig {
  serviceUrl: string
  wsPath?: string
  reconnectInterval?: number
}

export interface ExtensionState {
  wsConnected: boolean
  registeredTabs: Map<number, { provider: string; participantId: string }>
  chatgptAuthenticated: boolean
  claudeAuthenticated: boolean
}

// ============ 常量 ============

const DEFAULT_SERVICE_URL = 'http://localhost:3000'
const WS_PATH = '/ws/extension'
const RECONNECT_INTERVAL = 5000

// ============ 全局实例 ============

let wsClient: LocalWsClient | null = null
let tabRegistry: TabRegistry | null = null
let messageRouter: MessageRouter | null = null
let chatgptClient: ChatGPTAPIClient | null = null
let claudeClient: ClaudeAPIClient | null = null

// ============ 初始化 ============

async function initializeExtension(): Promise<void> {
  console.log('[ServiceWorker] Initializing extension...')

  // 从 storage 读取配置
  const config = await loadConfig()

  // 初始化组件
  tabRegistry = new TabRegistry()
  wsClient = new LocalWsClient(`${config.serviceUrl}${WS_PATH}`)
  messageRouter = new MessageRouter(wsClient, tabRegistry)

  // 设置 WebSocket 消息处理
  setupWebSocketHandlers()

  // 设置消息监听
  setupMessageListener()

  // 设置生命周期管理
  setupLifecycleHandlers()

  // 初始化 API 客户端
  await initializeAPIClients()

  // 连接 WebSocket
  await connectWebSocket()

  console.log('[ServiceWorker] Extension initialized')
}

// ============ 配置管理 ============

async function loadConfig(): Promise<ExtensionConfig> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        serviceUrl: DEFAULT_SERVICE_URL,
        wsPath: WS_PATH,
        reconnectInterval: RECONNECT_INTERVAL
      },
      (items) => {
        resolve(items as ExtensionConfig)
      }
    )
  })
}

async function saveConfig(config: Partial<ExtensionConfig>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set(config, () => {
      resolve()
    })
  })
}

// ============ API 客户端初始化 ============

async function initializeAPIClients(): Promise<void> {
  try {
    // 初始化 ChatGPT 客户端
    const chatgptToken = await ChatGPTAPIClient.getAccessTokenFromCookies()
    chatgptClient = new ChatGPTAPIClient({ accessToken: chatgptToken })
    messageRouter?.setChatGPTClient(chatgptClient)
    console.log('[ServiceWorker] ChatGPT client initialized')
  } catch (error) {
    console.warn('[ServiceWorker] ChatGPT not authenticated:', error)
  }

  try {
    // 初始化 Claude 客户端
    const claudeToken = await ClaudeAPIClient.getAccessTokenFromCookies()
    claudeClient = new ClaudeAPIClient({ accessToken: claudeToken })
    messageRouter?.setClaudeClient(claudeClient)
    console.log('[ServiceWorker] Claude client initialized')
  } catch (error) {
    console.warn('[ServiceWorker] Claude not authenticated:', error)
  }
}

// ============ WebSocket 处理 ============

async function connectWebSocket(): Promise<void> {
  if (!wsClient) return

  try {
    await wsClient.connect()

    // 发送 hello 消息
    wsClient.send({
      type: 'extension.hello',
      version: '0.1.0',
      timestamp: Date.now(),
      capabilities: [
        'ai.tab.detected',
        'ai.prompt.send',
        'conversation.list',
        'conversation.get',
        'conversation.delete',
        'conversation.rename',
        'conversation.share',
        'auth.status',
        'auth.refresh'
      ]
    })
  } catch (error) {
    console.error('[ServiceWorker] WebSocket connection failed:', error)
    // 延迟重连
    setTimeout(() => connectWebSocket(), RECONNECT_INTERVAL)
  }
}

function setupWebSocketHandlers(): void {
  if (!wsClient) return

  wsClient.on('open', () => {
    console.log('[ServiceWorker] WebSocket connected')
    broadcastStateUpdate('wsConnected', true)
  })

  wsClient.on('message', (data) => {
    messageRouter?.handleServerMessage(data)
  })

  wsClient.on('close', () => {
    console.log('[ServiceWorker] WebSocket disconnected')
    broadcastStateUpdate('wsConnected', false)
  })

  wsClient.on('error', (error) => {
    console.error('[ServiceWorker] WebSocket error:', error)
  })
}

// ============ 消息监听 ============

function setupMessageListener(): void {
  chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {
      if (!messageRouter) return

      messageRouter.handleContentMessage(
        message,
        sender,
        (response) => {
          sendResponse(response)
        }
      )

      // 返回 true 表示异步响应
      return true
    }
  )
}

// ============ 生命周期管理 ============

function setupLifecycleHandlers(): void {
  // Tab 更新时重新检查
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
      checkAndRegisterTab(tabId, tab.url)
    }
  })

  // Tab 激活时重新检查
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId)
    if (tab.url) {
      checkAndRegisterTab(activeInfo.tabId, tab.url)
    }
  })

  // Tab 关闭时清理
  chrome.tabs.onRemoved.addListener((tabId) => {
    tabRegistry?.unregisterTab(tabId)

    // 通知服务端
    wsClient?.send({
      type: 'ai.tab.unregister',
      tabId
    })
  })

  // 扩展安装时
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      console.log('[ServiceWorker] Extension installed')

      // 设置默认配置
      chrome.storage.sync.set({
        serviceUrl: DEFAULT_SERVICE_URL,
        reconnectInterval: RECONNECT_INTERVAL
      })
    } else if (details.reason === 'update') {
      console.log('[ServiceWorker] Extension updated to', chrome.runtime.getManifest().version)
    }
  })
}

// ============ Tab 注册 ============

async function checkAndRegisterTab(tabId: number, url: string): Promise<void> {
  if (!url) return

  // 检测 AI 平台
  let provider: string | null = null

  if (url.includes('chatgpt.com') || url.includes('chat.openai.com')) {
    provider = 'chatgpt'
  } else if (url.includes('claude.ai')) {
    provider = 'claude'
  } else if (url.includes('kimi.com')) {
    provider = 'kimi'
  } else if (url.includes('deepseek.com')) {
    provider = 'deepseek'
  } else if (url.includes('qianwen.aliyun.com') || url.includes('tongyi.aliyun.com')) {
    provider = 'qwen'
  } else if (url.includes('chat.z.ai')) {
    provider = 'glm'
  }

  if (provider) {
    // 检查是否已注册
    const existing = tabRegistry?.getTab(tabId)
    if (!existing) {
      // 注入 content script
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['src/content/index.js']
        })

        // 注册 tab
        const participantId = `${provider}-${tabId}`
        tabRegistry?.registerTab(tabId, provider, participantId)

        // 通知服务端
        wsClient?.send({
          type: 'ai.tab.register',
          participantId,
          provider,
          tabId,
          url,
          status: 'ready'
        })

        console.log(`[ServiceWorker] Registered tab ${tabId} as ${provider}`)
      } catch (error) {
        console.error(`[ServiceWorker] Failed to register tab ${tabId}:`, error)
      }
    }
  }
}

// ============ 状态广播 ============

function broadcastStateUpdate(key: string, value: unknown): void {
  // 通知所有打开的 popup 和 options 页面
  chrome.runtime.sendMessage({
    type: 'extension.state.update',
    key,
    value
  })
}

// ============ 辅助函数 ============

export function getExtensionState(): ExtensionState {
  return {
    wsConnected: wsClient?.isConnected() || false,
    registeredTabs: tabRegistry?.getAllTabs() || new Map(),
    chatgptAuthenticated: !!chatgptClient,
    claudeAuthenticated: !!claudeClient
  }
}

export function updateServiceUrl(url: string): Promise<void> {
  return saveConfig({ serviceUrl: url }).then(() => {
    // 重新连接
    wsClient?.close()
    connectWebSocket()
  })
}

// ============ 启动 ============

// Service Worker 生命周期
self.addEventListener('install', () => {
  console.log('[ServiceWorker] Installing...')
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...')
  event.waitUntil(initializeExtension())
  self.clients.claim()
})

// 初始化
initializeExtension()
