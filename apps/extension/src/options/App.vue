<template>
  <div class="app">
    <header class="header">
      <h1>AI Council Settings</h1>
    </header>

    <main class="main">
      <SettingsPanel />
    </main>
  </div>
</template>

<script setup lang="ts">
import SettingsPanel from './components/SettingsPanel.vue'
</script>

<style scoped>
.app {
  min-height: 100vh;
  background: #fafafa;
}

.header {
  padding: 20px 24px;
  background: #fff;
  border-bottom: 1px solid #eee;
}

.header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

.main {
  padding: 24px;
}
</style>
