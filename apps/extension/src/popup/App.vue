<template>
  <div class="app">
    <header class="header">
      <h1>AI Council</h1>
      <StatusPanel />
    </header>

    <main class="main">
      <ParticipantList />
    </main>

    <footer class="footer">
      <button class="btn-settings" @click="openSettings">
        设置
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import StatusPanel from './components/StatusPanel.vue'
import ParticipantList from './components/ParticipantList.vue'

function openSettings() {
  chrome.runtime.openOptionsPage()
}
</script>

<style scoped>
.app {
  width: 320px;
  min-height: 400px;
  background: #1a1a2e;
  color: #e0e0e0;
  display: flex;
  flex-direction: column;
}

.header {
  padding: 16px;
  background: #16213e;
  border-bottom: 1px solid #0f3460;
}

.header h1 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.main {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.footer {
  padding: 12px 16px;
  background: #16213e;
  border-top: 1px solid #0f3460;
}

.btn-settings {
  width: 100%;
  padding: 10px;
  background: #0f3460;
  border: none;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-settings:hover {
  background: #1a4a7a;
}
</style>
