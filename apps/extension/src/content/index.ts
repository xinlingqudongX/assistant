// Content Script 入口
// 监听 DOM 变化，检测 AI 响应，注入操作按钮

import { BridgeProtocol } from './bridge-protocol'
import { ChatGPTAdapter } from './chatgpt.adapter'
import { ClaudeAdapter } from './claude.adapter'
import type { Provider, Message } from '@ai-council/protocol'

// ============ 全局变量 ============

let currentProvider: Provider | null = null
let adapter: ChatGPTAdapter | ClaudeAdapter | null = null
let isInitialized = false

// ============ 初始化 ============

function initialize(): void {
  if (isInitialized) return

  // 检测当前页面是哪个 AI 平台
  const url = window.location.href

  if (url.includes('chatgpt.com') || url.includes('chat.openai.com')) {
    currentProvider = 'chatgpt'
    adapter = new ChatGPTAdapter()
  } else if (url.includes('claude.ai')) {
    currentProvider = 'claude'
    adapter = new ClaudeAdapter()
  } else {
    console.warn('[ContentScript] Unknown AI platform')
    return
  }

  console.log(`[ContentScript] Initialized for ${currentProvider}`)

  // 通知 background script
  notifyBackground()

  // 设置消息监听
  setupMessageListener()

  // 开始观察 DOM 变化
  observeDOM()

  isInitialized = true
}

// ============ 通知 Background ============

function notifyBackground(): void {
  chrome.runtime.sendMessage({
    type: 'ai.tab.detected',
    tabId: getCurrentTabId(),
    provider: currentProvider,
    url: window.location.href
  })
}

function getCurrentTabId(): number {
  // 从 URL 参数获取 tabId (background script 注入时会添加)
  const params = new URLSearchParams(window.location.search)
  const tabId = params.get('tabId')

  if (tabId) {
    return parseInt(tabId, 10)
  }

  // 回退：发送消息给 background script 询问
  return 0
}

// ============ 消息监听 ============

function setupMessageListener(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const typedMessage = message as {
      type: string
      correlationId?: string
      participantId?: string
      role?: string
      prompt?: string
      [key: string]: unknown
    }

    switch (typedMessage.type) {
      case 'ai.prompt.execute':
        handlePromptExecute(
          typedMessage.correlationId!,
          typedMessage.participantId!,
          typedMessage.role!,
          typedMessage.prompt!
        )
        sendResponse({ success: true })
        break

      case 'ai.tab.ping':
        sendResponse({
          type: 'ai.tab.pong',
          provider: currentProvider,
          url: window.location.href
        })
        break

      default:
        console.warn('[ContentScript] Unknown message:', typedMessage.type)
    }

    return true
  })
}

// ============ Prompt 执行 ============

async function handlePromptExecute(
  correlationId: string,
  participantId: string,
  role: string,
  prompt: string
): Promise<void> {
  if (!adapter) {
    chrome.runtime.sendMessage({
      type: 'ai.response.error',
      correlationId,
      participantId,
      error: {
        code: 'NO_ADAPTER',
        message: 'Adapter not initialized'
      }
    })
    return
  }

  try {
    // 更新状态为处理中
    updateStatus(participantId, 'thinking')

    // 使用 adapter 发送 prompt
    const result = await adapter.sendPrompt(prompt, role)

    // 发送成功响应
    chrome.runtime.sendMessage({
      type: 'ai.response.ready',
      correlationId,
      participantId,
      text: result.text,
      parsed: result.parsed
    })

    // 更新状态为完成
    updateStatus(participantId, 'done')
  } catch (error) {
    console.error('[ContentScript] Prompt execution failed:', error)

    // 发送错误响应
    chrome.runtime.sendMessage({
      type: 'ai.response.error',
      correlationId,
      participantId,
      error: {
        code: 'EXECUTION_ERROR',
        message: String(error)
      }
    })

    // 更新状态为错误
    updateStatus(participantId, 'error')
  }
}

// ============ 状态更新 ============

function updateStatus(participantId: string, status: string): void {
  chrome.runtime.sendMessage({
    type: 'ai.status.update',
    participantId,
    status
  })
}

// ============ DOM 观察 ============

let mutationObserver: MutationObserver | null = null

function observeDOM(): void {
  // 创建观察器
  mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // 检查新增的节点
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          handleNewElement(node as Element)
        }
      }
    }
  })

  // 开始观察
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true
  })

  // 对现有元素进行处理
  handleExistingElements()
}

function handleExistingElements(): void {
  // 检查页面上的 AI 响应元素
  const existingResponses = document.querySelectorAll('[data-message-author-role]')

  for (const element of existingResponses) {
    handleMessageElement(element as Element)
  }
}

function handleNewElement(element: Element): void {
  // 检查是否是 AI 消息元素
  if (element.matches?.('[data-message-author-role]')) {
    handleMessageElement(element)
  }

  // 检查子元素
  const messageElements = element.querySelectorAll?.('[data-message-author-role]')
  if (messageElements) {
    for (const msgElement of messageElements) {
      handleMessageElement(msgElement as Element)
    }
  }
}

function handleMessageElement(element: Element): void {
  if (!adapter) return

  // 获取消息内容
  const role = element.getAttribute('data-message-author-role')
  const content = adapter.getMessageContent(element)

  if (content) {
    // 通过 Bridge 发送消息
    BridgeProtocol.sendMessage({
      type: 'ai.message.detected',
      provider: currentProvider,
      role,
      content
    })
  }
}

// ============ 启动 ============

// 等待 DOM 加载完成
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize)
} else {
  initialize()
}
