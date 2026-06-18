<template>
  <div class="status-panel">
    <div class="status-row">
      <div class="status-item">
        <span class="status-label">Connection</span>
        <span class="status-value" :class="connectionStatus">
          {{ connectionStatusText }}
        </span>
      </div>
      <div class="status-item">
        <span class="status-label">Room</span>
        <span class="status-value">{{ roomStatus }}</span>
      </div>
    </div>
    <div v-if="lastError" class="error-message">
      {{ lastError }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const isConnected = ref(false)
const roomStatus = ref('Disconnected')
const lastError = ref<string | null>(null)

const connectionStatus = computed(() => {
  return isConnected.value ? 'connected' : 'disconnected'
})

const connectionStatusText = computed(() => {
  return isConnected.value ? 'Connected' : 'Disconnected'
})

onMounted(() => {
  // 监听连接状态更新
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'extension.state.update') {
      if (message.key === 'wsConnected') {
        isConnected.value = message.value
      }
    }
  })

  // 获取初始状态
  chrome.runtime.sendMessage({ type: 'extension.state.get' })
    .then((response) => {
      if (response) {
        isConnected.value = response.wsConnected || false
        roomStatus.value = response.roomStatus || 'Disconnected'
      }
    })
    .catch(console.error)
})
</script>

<style scoped>
.status-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-row {
  display: flex;
  gap: 16px;
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.status-label {
  font-size: 11px;
  color: #666;
  text-transform: uppercase;
}

.status-value {
  font-size: 13px;
  font-weight: 500;
  color: #e0e0e0;
}

.status-value.connected {
  color: #10a37f;
}

.status-value.disconnected {
  color: #e74c3c;
}

.error-message {
  font-size: 12px;
  color: #e74c3c;
  padding: 8px;
  background: rgba(231, 76, 60, 0.1);
  border-radius: 4px;
}
</style>
