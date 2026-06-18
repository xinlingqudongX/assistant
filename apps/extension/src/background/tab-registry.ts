// Tab Registry - 管理扩展打开的 AI 标签页

export interface TabInfo {
  tabId: number
  provider: string
  participantId: string
  registeredAt: number
  lastActive?: number
}

export class TabRegistry {
  private tabs: Map<number, TabInfo> = new Map()
  private participantIndex: Map<string, number> = new Map()

  /**
   * 注册一个新的 tab
   */
  registerTab(tabId: number, provider: string, participantId: string): void {
    const info: TabInfo = {
      tabId,
      provider,
      participantId,
      registeredAt: Date.now(),
      lastActive: Date.now()
    }

    this.tabs.set(tabId, info)
    this.participantIndex.set(participantId, tabId)

    console.log(`[TabRegistry] Registered tab ${tabId} (${provider})`)
  }

  /**
   * 注销一个 tab
   */
  unregisterTab(tabId: number): void {
    const info = this.tabs.get(tabId)

    if (info) {
      this.participantIndex.delete(info.participantId)
      this.tabs.delete(tabId)

      console.log(`[TabRegistry] Unregistered tab ${tabId}`)
    }
  }

  /**
   * 获取 tab 信息
   */
  getTab(tabId: number): TabInfo | undefined {
    const info = this.tabs.get(tabId)

    // 更新最后活跃时间
    if (info) {
      info.lastActive = Date.now()
    }

    return info
  }

  /**
   * 通过 participantId 获取 tab
   */
  getTabByParticipantId(participantId: string): TabInfo | undefined {
    const tabId = this.participantIndex.get(participantId)

    if (tabId !== undefined) {
      return this.getTab(tabId)
    }

    return undefined
  }

  /**
   * 获取所有 tab
   */
  getAllTabs(): Map<number, TabInfo> {
    return new Map(this.tabs)
  }

  /**
   * 按 provider 获取 tabs
   */
  getTabsByProvider(provider: string): TabInfo[] {
    const result: TabInfo[] = []

    for (const info of this.tabs.values()) {
      if (info.provider === provider) {
        result.push(info)
      }
    }

    return result
  }

  /**
   * 更新 tab 的 participantId
   */
  updateParticipantId(tabId: number, participantId: string): void {
    const info = this.tabs.get(tabId)

    if (info) {
      // 移除旧的索引
      this.participantIndex.delete(info.participantId)

      // 更新并创建新索引
      info.participantId = participantId
      this.participantIndex.set(participantId, tabId)
    }
  }

  /**
   * 检查 tab 是否已注册
   */
  hasTab(tabId: number): boolean {
    return this.tabs.has(tabId)
  }

  /**
   * 获取已注册的 tab 数量
   */
  get size(): number {
    return this.tabs.size
  }

  /**
   * 清理过期的 tabs (超过 30 分钟不活跃)
   */
  cleanupExpired(maxAgeMs = 30 * 60 * 1000): number {
    const now = Date.now()
    let cleaned = 0

    for (const [tabId, info] of this.tabs.entries()) {
      const lastActive = info.lastActive || info.registeredAt

      if (now - lastActive > maxAgeMs) {
        this.participantIndex.delete(info.participantId)
        this.tabs.delete(tabId)
        cleaned++
      }
    }

    if (cleaned > 0) {
      console.log(`[TabRegistry] Cleaned up ${cleaned} expired tabs`)
    }

    return cleaned
  }

  /**
   * 清除所有 tabs
   */
  clear(): void {
    this.tabs.clear()
    this.participantIndex.clear()

    console.log('[TabRegistry] Cleared all tabs')
  }

  /**
   * 序列化用于存储
   */
  serialize(): TabInfo[] {
    return Array.from(this.tabs.values())
  }

  /**
   * 反序列化恢复
   */
  deserialize(data: TabInfo[]): void {
    this.clear()

    for (const info of data) {
      this.tabs.set(info.tabId, info)
      this.participantIndex.set(info.participantId, info.tabId)
    }

    console.log(`[TabRegistry] Restored ${data.length} tabs`)
  }
}
