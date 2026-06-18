// ChatGPT Adapter - ChatGPT 平台适配器

import { BaseAdapter } from './base.adapter'

// ============ ChatGPT Adapter ============

export class ChatGPTAdapter extends BaseAdapter {
  private static readonly PROVIDER = 'chatgpt'

  getProvider(): string {
    return ChatGPTAdapter.PROVIDER
  }

  /**
   * 检测是否在 ChatGPT 页面
   */
  static detect(): boolean {
    return window.location.href.includes('chatgpt.com') ||
           window.location.href.includes('chat.openai.com')
  }

  /**
   * 获取消息内容
   */
  getMessageContent(element: Element): string | null {
    // 尝试多种选择器
    const selectors = [
      '[data-message-author-role="assistant"] [data-message-content] .markdown',
      '[data-message-author-role="assistant"] .text-message .content',
      '.message-content p',
      '[class*="message"] [class*="content"]'
    ]

    for (const selector of selectors) {
      const content = element.querySelector(selector)
      if (content) {
        return content.textContent?.trim() || null
      }
    }

    // 回退：直接获取文本
    return element.textContent?.trim() || null
  }

  /**
   * 获取输入框
   */
  getInputElement(): Element | null {
    // 主要选择器
    const selectors = [
      '#prompt-textarea',
      'textarea[data-id="root"]',
      'div[contenteditable="true"]',
      'textarea[placeholder*="Message"]',
      'textarea'
    ]

    for (const selector of selectors) {
      const input = document.querySelector(selector)
      if (input) {
        return input
      }
    }

    return null
  }

  /**
   * 获取发送按钮
   */
  getSendButton(): Element | null {
    const selectors = [
      'button[data-testid="send-button"]',
      'button[aria-label="Send"]',
      '[class*="send"] button'
    ]

    for (const selector of selectors) {
      const button = document.querySelector(selector)
      if (button) {
        return button
      }
    }

    // 尝试在输入框父级中查找
    const input = this.getInputElement()
    if (input) {
      const parent = input.closest('[class*="input"]')
      if (parent) {
        const button = parent.querySelector('button')
        if (button) return button
      }
    }

    return null
  }

  /**
   * 检查是否正在加载
   */
  isLoading(): boolean {
    // 检查加载指示器
    const indicators = [
      '[data-testid="loading-spinner"]',
      '[class*="in_progress"]',
      '[class*="generating"]',
      '[class*="loading"]'
    ]

    for (const selector of indicators) {
      if (document.querySelector(selector)) {
        return true
      }
    }

    return false
  }

  /**
   * 等待响应完成
   */
  async waitForResponse(): Promise<void> {
    // 等待加载状态开始
    await this.waitForLoadingStart()

    // 等待加载状态结束
    await this.waitForLoadingEnd()
  }

  /**
   * 等待加载开始
   */
  private async waitForLoadingStart(): Promise<void> {
    // 如果已经在加载，直接返回
    if (this.isLoading()) return

    // 等待加载状态出现（最多 5 秒）
    const started = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 5000)

      const observer = new MutationObserver(() => {
        if (this.isLoading()) {
          clearTimeout(timeout)
          observer.disconnect()
          resolve(true)
        }
      })

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
      })
    })

    // 如果超时，可能已经加载完成
    if (!started) {
      console.log('[ChatGPTAdapter] Loading did not start in time')
    }
  }

  /**
   * 等待加载结束
   */
  private async waitForLoadingEnd(): Promise<void> {
    // 等待加载状态消失（最多 60 秒）
    await this.waitForElementGone('[data-testid="loading-spinner"]', 60000)
    await this.waitForElementGone('[class*="in_progress"]', 60000)
    await this.waitForElementGone('[class*="generating"]', 60000)

    // 额外等待一下确保渲染完成
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  /**
   * 获取最后一条 AI 回复
   */
  getLastResponse(): string | null {
    // 获取所有 assistant 消息
    const messages = document.querySelectorAll(
      '[data-message-author-role="assistant"]'
    )

    if (messages.length === 0) return null

    // 返回最后一条
    const lastMessage = messages[messages.length - 1]
    return this.getMessageContent(lastMessage)
  }

  /**
   * 解析响应
   */
  protected parseResponse(text: string): unknown {
    // 尝试解析 JSON
    try {
      // 检查是否以 ```json 开头
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1])
      }

      // 检查是否以 { 或 [ 开头
      const trimmed = text.trim()
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return JSON.parse(trimmed)
      }
    } catch {
      // 不是 JSON，返回原文本
    }

    return { text }
  }

  /**
   * 格式化消息（如需要）
   */
  formatMessage(message: string): string {
    // ChatGPT 特殊处理
    return message.trim()
  }
}
