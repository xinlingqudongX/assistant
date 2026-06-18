// Base Adapter - 定义 AI 平台适配器接口

import type { Message } from '@ai-council/protocol'

// ============ Adapter 接口 ============

export interface AdapterResult {
  text: string
  parsed?: unknown
}

export interface SendPromptOptions {
  conversationId?: string
  parentMessageId?: string
}

export abstract class BaseAdapter {
  /**
   * 获取适配器的 provider 名称
   */
  abstract getProvider(): string

  /**
   * 检测是否在此平台上
   */
  static detect(): boolean {
    return false
  }

  /**
   * 获取消息内容
   */
  abstract getMessageContent(element: Element): string | null

  /**
   * 获取用户输入框
   */
  abstract getInputElement(): Element | null

  /**
   * 获取发送按钮
   */
  abstract getSendButton(): Element | null

  /**
   * 检查是否正在加载
   */
  abstract isLoading(): boolean

  /**
   * 等待加载完成
   */
  abstract waitForResponse(): Promise<void>

  /**
   * 获取最后一条 AI 回复
   */
  abstract getLastResponse(): string | null

  /**
   * 发送 prompt
   */
  async sendPrompt(
    prompt: string,
    role: string = 'user',
    options: SendPromptOptions = {}
  ): Promise<AdapterResult> {
    const inputElement = this.getInputElement()

    if (!inputElement) {
      throw new Error('Input element not found')
    }

    // 清空输入框
    this.clearInput(inputElement)

    // 输入文本
    this.typeText(inputElement, prompt)

    // 发送
    const sendButton = this.getSendButton()
    if (sendButton && !sendButton.hasAttribute('disabled')) {
      (sendButton as HTMLButtonElement).click()
    }

    // 等待响应
    await this.waitForResponse()

    // 获取响应
    const response = this.getLastResponse()

    if (!response) {
      throw new Error('No response received')
    }

    return {
      text: response,
      parsed: this.parseResponse(response)
    }
  }

  /**
   * 清空输入框
   */
  protected clearInput(element: Element): void {
    // 触发 input 事件
    const nativeInputValueSetter = (Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    ) || Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    ))?.set

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(element, '')
    }

    element.dispatchEvent(new Event('input', { bubbles: true }))
  }

  /**
   * 输入文本
   */
  protected typeText(element: Element, text: string): void {
    const nativeInputValueSetter = (Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    ) || Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    ))?.set

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(element, text)
    }

    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  }

  /**
   * 解析响应
   */
  protected parseResponse(text: string): unknown {
    // 默认返回原文本，子类可以重写实现更复杂的解析
    return { text }
  }

  /**
   * 等待元素出现
   */
  protected waitForElement(
    selector: string,
    timeout: number = 10000
  ): Promise<Element | null> {
    return new Promise((resolve) => {
      // 先检查是否已存在
      const existing = document.querySelector(selector)
      if (existing) {
        resolve(existing)
        return
      }

      // 设置观察器
      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector)
        if (element) {
          observer.disconnect()
          resolve(element)
        }
      })

      observer.observe(document.body, {
        childList: true,
        subtree: true
      })

      // 超时处理
      setTimeout(() => {
        observer.disconnect()
        resolve(null)
      }, timeout)
    })
  }

  /**
   * 等待元素消失
   */
  protected waitForElementGone(
    selector: string,
    timeout: number = 30000
  ): Promise<void> {
    return new Promise((resolve) => {
      // 检查是否已不存在
      const existing = document.querySelector(selector)
      if (!existing) {
        resolve()
        return
      }

      // 设置观察器
      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector)
        if (!element) {
          observer.disconnect()
          resolve()
        }
      })

      observer.observe(document.body, {
        childList: true,
        subtree: true
      })

      // 超时处理
      setTimeout(() => {
        observer.disconnect()
        resolve()
      }, timeout)
    })
  }
}
