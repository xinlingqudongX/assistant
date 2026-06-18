// Claude Adapter - Claude AI 平台适配器

import { BaseAdapter } from './base.adapter'

// ============ Claude Adapter ============

export class ClaudeAdapter extends BaseAdapter {
  private static readonly PROVIDER = 'claude'

  getProvider(): string {
    return ClaudeAdapter.PROVIDER
  }

  /**
   * 检测是否在 Claude 页面
   */
  static detect(): boolean {
    return window.location.href.includes('claude.ai')
  }

  /**
   * 获取消息内容
   */
  getMessageContent(element: Element): string | null {
    // 尝试多种选择器
    const selectors = [
      '.assistant-markdown',
      '.prose .content',
      '[data-testid="assistant-message"] .content',
      '.message-assistant p',
      '.claude-message .text'
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
    const selectors = [
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="Ask"]',
      'textarea[data-testid*="input"]',
      'div[contenteditable="true"]',
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
      'button[type="submit"]',
      '[aria-label="Send"]',
      '[class*="send"] button'
    ]

    for (const selector of selectors) {
      const button = document.querySelector(selector)
      if (button) {
        return button
      }
    }

    // 尝试在输入框附近查找
    const input = this.getInputElement()
    if (input) {
      const container = input.closest('[class*="input"]')
      if (container) {
        const button = container.querySelector('button')
        if (button) return button
      }
    }

    return null
  }

  /**
   * 检查是否正在加载
   */
  isLoading(): boolean {
    const indicators = [
      '[data-testid="thinking-indicator"]',
      '[class*="thinking"]',
      '[class*="generating"]',
      '[class*="loading"]',
      '[class*="in-progress"]'
    ]

    for (const selector of indicators) {
      if (document.querySelector(selector)) {
        return true
      }
    }

    // 也检查是否有 thinking 动画
    const thinkingElements = document.querySelectorAll('[class*="animate-pulse"]')
    if (thinkingElements.length > 0) {
      return true
    }

    return false
  }

  /**
   * 等待响应完成
   */
  async waitForResponse(): Promise<void> {
    // Claude 可能会有 thinking 阶段
    // 先等待 thinking 完成
    await this.waitForThinkingEnd()

    // 等待实际响应完成
    await this.waitForResponseEnd()
  }

  /**
   * 等待 thinking 结束
   */
  private async waitForThinkingEnd(): Promise<void> {
    // 等待 thinking 元素消失
    const thinkingElement = document.querySelector('[class*="thinking"], [class*="thought"]')

    if (!thinkingElement) {
      // 没有 thinking 元素，直接返回
      return
    }

    // 等待消失（最多 30 秒）
    await this.waitForElementGone('[class*="thinking"]', 30000)
  }

  /**
   * 等待响应结束
   */
  private async waitForResponseEnd(): Promise<void> {
    // 等待所有加载指示器消失
    await this.waitForElementGone('[class*="generating"]', 60000)
    await this.waitForElementGone('[class*="in-progress"]', 60000)

    // 额外等待确保渲染完成
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  /**
   * 获取最后一条 AI 回复
   */
  getLastResponse(): string | null {
    // 获取所有 assistant 消息
    const messages = document.querySelectorAll(
      '[data-testid="assistant-message"], [class*="message"][class*="assistant"]'
    )

    if (messages.length === 0) {
      // 尝试其他选择器
      const altMessages = document.querySelectorAll(
        '.main .message:last-child, .conversation .message:last-child'
      )
      if (altMessages.length > 0) {
        return this.getMessageContent(altMessages[altMessages.length - 1])
      }
      return null
    }

    // 返回最后一条
    const lastMessage = messages[messages.length - 1]
    return this.getMessageContent(lastMessage)
  }

  /**
   * 解析响应
   */
  protected parseResponse(text: string): unknown {
    // Claude 的响应通常是纯文本，尝试解析 JSON
    try {
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1])
      }

      const trimmed = text.trim()
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return JSON.parse(trimmed)
      }
    } catch {
      // 不是 JSON
    }

    return { text }
  }

  /**
   * 格式化消息（如需要）
   */
  formatMessage(message: string): string {
    // Claude 特殊处理
    return message.trim()
  }
}
