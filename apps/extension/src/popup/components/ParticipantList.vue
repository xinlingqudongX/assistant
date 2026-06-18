<template>
  <div class="participant-list">
    <div class="section-title">
      参与者 ({{ participants.length }})
    </div>

    <div v-if="participants.length === 0" class="empty-state">
      <p>未检测到 AI 参与者</p>
      <p class="hint">打开 ChatGPT 或 Claude 标签页开始使用</p>
    </div>

    <div v-else class="participants">
      <div
        v-for="participant in participants"
        :key="participant.id"
        class="participant-card"
        :class="{ active: participant.active }"
      >
        <div class="participant-icon" :class="participant.provider">
          {{ participant.icon }}
        </div>
        <div class="participant-info">
          <div class="participant-name">{{ participant.name }}</div>
          <div class="participant-status">
            <span class="status-dot" :class="participant.status"></span>
            {{ participant.statusText }}
          </div>
        </div>
        <div class="participant-actions">
          <button
            v-if="participant.active"
            class="btn-action"
            @click="$emit('select', participant)"
          >
            选择
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Participant {
  id: string
  name: string
  provider: string
  icon: string
  status: string
  statusText: string
  active: boolean
}

defineEmits<{
  (e: 'select', participant: Participant): void
}>()

const participants = ref<Participant[]>([])

onMounted(async () => {
  // 从 background script 获取参与者列表
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'participants.list'
    })

    if (response?.participants) {
      participants.value = response.participants
    }
  } catch (error) {
    console.error('Failed to load participants:', error)
  }

  // 监听参与者更新
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'participants.update') {
      participants.value = message.participants
    }
  })
})
</script>

<style scoped>
.participant-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: #888;
  letter-spacing: 0.5px;
}

.empty-state {
  text-align: center;
  padding: 24px;
  color: #666;
}

.empty-state .hint {
  font-size: 12px;
  margin-top: 8px;
}

.participants {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.participant-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #16213e;
  border-radius: 8px;
  border: 1px solid transparent;
  transition: border-color 0.2s;
}

.participant-card.active {
  border-color: #0f3460;
}

.participant-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: #0f3460;
}

.participant-icon.chatgpt {
  background: linear-gradient(135deg, #10a37f, #0d8a66);
}

.participant-icon.claude {
  background: linear-gradient(135deg, #cc785c, #b35d3d);
}

.participant-info {
  flex: 1;
}

.participant-name {
  font-weight: 500;
  color: #fff;
  margin-bottom: 4px;
}

.participant-status {
  font-size: 12px;
  color: #888;
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #666;
}

.status-dot.ready {
  background: #10a37f;
}

.status-dot.thinking {
  background: #f0a500;
}

.status-dot.error {
  background: #e74c3c;
}

.participant-actions {
  display: flex;
  gap: 4px;
}

.btn-action {
  padding: 6px 12px;
  background: #0f3460;
  border: none;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-action:hover {
  background: #1a4a7a;
}
</style>
