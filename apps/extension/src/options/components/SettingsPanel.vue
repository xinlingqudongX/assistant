<template>
  <div class="settings-panel">
    <h2>Settings</h2>

    <div class="settings-section">
      <h3>Service Connection</h3>
      <div class="form-group">
        <label>Service URL</label>
        <input
          v-model="serviceUrl"
          type="url"
          placeholder="http://localhost:3000"
          @blur="saveServiceUrl"
        />
      </div>
    </div>

    <div class="settings-section">
      <h3>AI Providers</h3>
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
          <button
            v-if="provider.status === 'disconnected'"
            class="btn-connect"
            @click="connectProvider(provider.id)"
          >
            Connect
          </button>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h3>Prompts</h3>
      <div class="form-group">
        <label>System Prompt Template</label>
        <textarea
          v-model="systemPrompt"
          rows="4"
          placeholder="Enter system prompt..."
        ></textarea>
      </div>
      <button class="btn-save" @click="savePrompt">
        Save Prompt
      </button>
    </div>

    <div class="settings-section">
      <h3>About</h3>
      <p class="about-text">
        AI Council v0.1.0<br />
        Decision Audit Engine for Browser AI
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Provider {
  id: string
  name: string
  status: string
  statusText: string
}

const serviceUrl = ref('http://localhost:3000')
const systemPrompt = ref('')
const providers = ref<Provider[]>([
  { id: 'chatgpt', name: 'ChatGPT', status: 'disconnected', statusText: 'Not connected' },
  { id: 'claude', name: 'Claude', status: 'disconnected', statusText: 'Not connected' }
])

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
})

async function saveServiceUrl() {
  await chrome.storage.sync.set({ serviceUrl: serviceUrl.value })
}

async function savePrompt() {
  await chrome.storage.sync.set({ systemPrompt: systemPrompt.value })
}

async function connectProvider(providerId: string) {
  const provider = providers.value.find(p => p.id === providerId)
  if (provider) {
    provider.status = 'connecting'
    provider.statusText = 'Connecting...'
  }

  try {
    await chrome.runtime.sendMessage({
      type: 'auth.refresh',
      provider: providerId
    })

    if (provider) {
      provider.status = 'connected'
      provider.statusText = 'Connected'
    }
  } catch (error) {
    if (provider) {
      provider.status = 'error'
      provider.statusText = 'Connection failed'
    }
  }

  // 保存状态
  await chrome.storage.sync.set({ providers: providers.value })
}
</script>

<style scoped>
.settings-panel {
  max-width: 600px;
  margin: 0 auto;
  padding: 24px;
}

h2 {
  font-size: 24px;
  margin-bottom: 24px;
  color: #333;
}

h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #333;
}

.settings-section {
  margin-bottom: 32px;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
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
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #10a37f;
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

.provider-name {
  font-weight: 500;
}

.provider-status {
  font-size: 12px;
  margin-left: 8px;
}

.provider-status.connected {
  color: #10a37f;
}

.provider-status.disconnected {
  color: #999;
}

.provider-status.error {
  color: #e74c3c;
}

.btn-connect,
.btn-save {
  padding: 8px 16px;
  background: #10a37f;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-connect:hover,
.btn-save:hover {
  background: #0d8a66;
}

.about-text {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
}
</style>
