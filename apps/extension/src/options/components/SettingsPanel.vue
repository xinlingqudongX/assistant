<template>
  <div class="settings-panel">
    <h2>设置</h2>

    <!-- Toast 通知 -->
    <Transition name="toast">
      <div v-if="toast.show" class="toast" :class="toast.type">
        <span class="toast-icon">{{ toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ' }}</span>
        <span class="toast-message">{{ toast.message }}</span>
      </div>
    </Transition>

    <div class="settings-section">
      <h3>服务连接</h3>
      <div class="form-group">
        <label>服务地址</label>
        <div class="input-with-button">
          <input
            v-model="serviceUrl"
            type="url"
            placeholder="http://localhost:17321"
          />
          <button
            class="btn-save-url"
            :disabled="isSavingUrl"
            @click="saveServiceUrl"
          >
            {{ isSavingUrl ? '保存中...' : '保存' }}
          </button>
        </div>
        <p class="helper-text">WebSocket 将连接到: {{ wsUrl }}</p>
      </div>
    </div>

    <div class="settings-section">
      <div class="section-header">
        <h3>AI 提供商</h3>
        <button
          class="btn-connect-all"
          :disabled="isConnectingAll"
          @click="connectAllProviders"
        >
          {{ isConnectingAll ? '连接中...' : '一键连接' }}
        </button>
      </div>
      <div class="provider-list">
        <div
          v-for="provider in providers"
          :key="provider.id"
          class="provider-item"
        >
          <div class="provider-info">
            <span class="provider-name">{{ provider.name }}</span>
            <span class="provider-status" :class="provider.status">
              {{ provider.statusText }}
            </span>
          </div>
          <div class="provider-actions">
            <button
              v-if="provider.status === 'disconnected' || provider.status === 'error'"
              class="btn-connect"
              :disabled="provider.status === 'connecting'"
              @click="connectProvider(provider.id)"
            >
              {{ provider.status === 'error' ? '重试' : provider.status === 'connecting' ? '连接中...' : '连接' }}
            </button>
            <button
              v-if="provider.status === 'error'"
              class="btn-authorize"
              @click="authorizeProvider(provider.id)"
            >
              授权
            </button>
            <span v-else-if="provider.status === 'connected'" class="status-badge connected">
              已连接
            </span>
            <span v-else-if="provider.status === 'connecting'" class="status-badge connecting">
              连接中...
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h3>提示词</h3>
      <div class="form-group">
        <label>系统提示词模板</label>
        <textarea
          v-model="systemPrompt"
          rows="4"
          placeholder="输入系统提示词..."
        ></textarea>
      </div>
      <button
        class="btn-save"
        :disabled="isSavingPrompt"
        @click="savePrompt"
      >
        {{ isSavingPrompt ? '保存中...' : '保存提示词' }}
      </button>
    </div>

    <div class="settings-section">
      <h3>关于</h3>
      <p class="about-text">
        AI Council v0.1.0<br />
        浏览器 AI 决策审计引擎
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface Provider {
  id: string
  name: string
  status: string
  statusText: string
  authUrl?: string
}

interface Toast {
  show: boolean
  message: string
  type: 'success' | 'error' | 'info'
}

// AI 平台授权 URL
const AUTH_URLS: Record<string, string> = {
  chatgpt: 'https://chat.openai.com',
  claude: 'https://claude.ai',
  qwen: 'https://qianwen.aliyun.com',
  deepseek: 'https://chat.deepseek.com',
  kimi: 'https://kimi.moonshot.cn',
  glm: 'https://chat.z.ai'
}

const serviceUrl = ref('http://localhost:17321')
const systemPrompt = ref('')
const isSavingUrl = ref(false)
const isSavingPrompt = ref(false)
const isConnectingAll = ref(false)
const toast = ref<Toast>({ show: false, message: '', type: 'info' })

const providers = ref<Provider[]>([
  { id: 'chatgpt', name: 'ChatGPT (OpenAI)', status: 'disconnected', statusText: '未连接', authUrl: AUTH_URLS.chatgpt },
  { id: 'claude', name: 'Claude (Anthropic)', status: 'disconnected', statusText: '未连接', authUrl: AUTH_URLS.claude },
  { id: 'qwen', name: '通义千问 (阿里云)', status: 'disconnected', statusText: '未连接', authUrl: AUTH_URLS.qwen },
  { id: 'deepseek', name: 'DeepSeek', status: 'disconnected', statusText: '未连接', authUrl: AUTH_URLS.deepseek },
  { id: 'kimi', name: 'Kimi (月之暗面)', status: 'disconnected', statusText: '未连接', authUrl: AUTH_URLS.kimi },
  { id: 'glm', name: 'GLM / 智谱清言', status: 'disconnected', statusText: '未连接', authUrl: AUTH_URLS.glm }
])

// 计算 WebSocket URL
const wsUrl = computed(() => {
  const base = serviceUrl.value.replace(/^http/, 'ws')
  return `${base}/ws`
})

// 显示 Toast 提示
function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  toast.value = { show: true, message, type }
  setTimeout(() => {
    toast.value.show = false
  }, 3000)
}

onMounted(async () => {
  // 加载保存的设置
  const settings = await chrome.storage.sync.get([
    'serviceUrl',
    'systemPrompt',
    'providers'
  ])

  if (settings.serviceUrl) {
    serviceUrl.value = settings.serviceUrl
  }

  if (settings.systemPrompt) {
    systemPrompt.value = settings.systemPrompt
  }

  if (settings.providers) {
    providers.value = settings.providers
  }

  // 监听来自 service worker 的消息
  chrome.runtime.onMessage.addListener((message) => {
    switch (message.type) {
      case 'auth.status':
        // 认证状态更新
        handleAuthStatusUpdate(message)
        break

      case 'connection.status':
        // 连接状态更新
        handleConnectionStatusUpdate(message)
        break

      case 'room.status':
        // 房间状态更新
        handleRoomStatusUpdate(message)
        break

      case 'error':
        // 错误通知
        showToast(message.message || '发生错误', 'error')
        break
    }
  })
})

// 处理认证状态更新
function handleAuthStatusUpdate(message: any) {
  const status = message.status

  if (status) {
    // 更新所有提供商的认证状态
    for (const provider of providers.value) {
      if (status[provider.id]) {
        if (status[provider.id].authenticated) {
          provider.status = 'connected'
          provider.statusText = '已连接'
        } else {
          provider.status = 'disconnected'
          provider.statusText = '未连接'
        }
      }
    }
  }

  // 更新单个提供商的状态
  if (message.provider) {
    const provider = providers.value.find(p => p.id === message.provider)
    if (provider) {
      if (message.success) {
        provider.status = 'connected'
        provider.statusText = '已连接'
        showToast(`${provider.name} 连接成功`, 'success')
      } else if (message.error) {
        provider.status = 'error'
        provider.statusText = '连接失败'
        showToast(`${provider.name} 连接失败: ${message.error}`, 'error')
      }
    }
  }

  // 保存更新后的状态
  chrome.storage.sync.set({ providers: providers.value })
}

// 处理连接状态更新
function handleConnectionStatusUpdate(message: any) {
  console.log('[Settings] Connection status:', message)
}

// 处理房间状态更新
function handleRoomStatusUpdate(message: any) {
  console.log('[Settings] Room status:', message)
}

async function saveServiceUrl() {
  if (isSavingUrl.value) return

  isSavingUrl.value = true

  try {
    await chrome.storage.sync.set({ serviceUrl: serviceUrl.value })

    // 通知 service worker 更新连接
    await chrome.runtime.sendMessage({
      type: 'service.updateUrl',
      url: serviceUrl.value
    })

    showToast('服务地址已保存', 'success')
  } catch (e) {
    console.error('Failed to save service URL:', e)
    showToast('保存失败，请重试', 'error')
  } finally {
    isSavingUrl.value = false
  }
}

async function savePrompt() {
  if (isSavingPrompt.value) return

  isSavingPrompt.value = true

  try {
    await chrome.storage.sync.set({ systemPrompt: systemPrompt.value })
    showToast('提示词已保存', 'success')
  } catch (e) {
    console.error('Failed to save prompt:', e)
    showToast('保存失败，请重试', 'error')
  } finally {
    isSavingPrompt.value = false
  }
}

async function connectProvider(providerId: string) {
  const provider = providers.value.find(p => p.id === providerId)
  if (!provider || provider.status === 'connecting') return

  provider.status = 'connecting'
  provider.statusText = '连接中...'

  try {
    await chrome.runtime.sendMessage({
      type: 'auth.refresh',
      provider: providerId
    })

    provider.status = 'connected'
    provider.statusText = '已连接'
    showToast(`${provider.name} 连接成功`, 'success')
  } catch (error) {
    provider.status = 'error'
    provider.statusText = '连接失败'
    showToast(`${provider.name} 连接失败`, 'error')
  }

  // 保存状态
  await chrome.storage.sync.set({ providers: providers.value })
}

async function connectAllProviders() {
  if (isConnectingAll.value) return

  isConnectingAll.value = true

  // 设置所有未连接/失败的为连接中状态
  for (const provider of providers.value) {
    if (provider.status !== 'connected' && provider.status !== 'connecting') {
      provider.status = 'connecting'
      provider.statusText = '连接中...'
    }
  }

  // 并发连接所有提供商
  const results = await Promise.allSettled(
    providers.value.map(async (provider) => {
      try {
        await chrome.runtime.sendMessage({
          type: 'auth.refresh',
          provider: provider.id
        })
        provider.status = 'connected'
        provider.statusText = '已连接'
        return { success: true, provider }
      } catch (error) {
        provider.status = 'error'
        provider.statusText = '连接失败'
        return { success: false, provider }
      }
    })
  )

  // 保存状态
  await chrome.storage.sync.set({ providers: providers.value })

  // 统计结果
  const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length
  const failCount = results.length - successCount

  if (failCount === 0) {
    showToast(`全部 ${successCount} 个提供商连接成功`, 'success')
  } else if (successCount === 0) {
    showToast(`全部 ${failCount} 个提供商连接失败`, 'error')
  } else {
    showToast(`${successCount} 个成功，${failCount} 个失败`, 'info')
  }

  isConnectingAll.value = false
}

function authorizeProvider(providerId: string) {
  const authUrl = AUTH_URLS[providerId]
  const provider = providers.value.find(p => p.id === providerId)

  if (authUrl) {
    // 在新标签页打开授权页面
    chrome.tabs.create({ url: authUrl })
    showToast(`已在新标签页打开 ${provider?.name || providerId} 授权页面`, 'info')
  }
}
</script>

<style scoped>
.settings-panel {
  max-width: 600px;
  margin: 0 auto;
  padding: 24px;
  position: relative;
}

/* Toast 样式 */
.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}

.toast.success {
  background: #10a37f;
  color: #fff;
}

.toast.error {
  background: #e74c3c;
  color: #fff;
}

.toast.info {
  background: #3498db;
  color: #fff;
}

.toast-icon {
  font-size: 16px;
}

/* Toast 动画 */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

h2 {
  font-size: 24px;
  margin-bottom: 24px;
  color: #333;
}

h3 {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.settings-section {
  margin-bottom: 32px;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  margin-bottom: 6px;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #10a37f;
}

.input-with-button {
  display: flex;
  gap: 8px;
}

.input-with-button input {
  flex: 1;
}

.btn-save-url {
  padding: 10px 16px;
  background: #10a37f;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s;
}

.btn-save-url:hover:not(:disabled) {
  background: #0d8a66;
}

.btn-save-url:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.helper-text {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.provider-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.provider-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #fff;
  border-radius: 6px;
}

.provider-info {
  display: flex;
  align-items: center;
}

.provider-name {
  font-weight: 500;
}

.provider-status {
  font-size: 12px;
  margin-left: 8px;
}

.provider-actions {
  display: flex;
  gap: 8px;
}

.status-badge {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 12px;
}

.status-badge.connected {
  background: #d4edda;
  color: #155724;
}

.status-badge.connecting {
  background: #fff3cd;
  color: #856404;
}

.status-badge.disconnected {
  background: #e9ecef;
  color: #6c757d;
}

.status-badge.error {
  background: #f8d7da;
  color: #721c24;
}

.btn-connect,
.btn-save,
.btn-connect-all {
  padding: 8px 16px;
  background: #10a37f;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-connect:hover:not(:disabled),
.btn-save:hover:not(:disabled),
.btn-connect-all:hover:not(:disabled) {
  background: #0d8a66;
}

.btn-connect:disabled,
.btn-save:disabled,
.btn-connect-all:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.btn-authorize {
  padding: 8px 16px;
  background: #007bff;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-authorize:hover {
  background: #0056b3;
}

.about-text {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
}
</style>
