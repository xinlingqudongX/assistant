import type { ManifestType } from '@crxjs/vite-plugin'

export default {
  manifest_version: 3,
  name: 'AI Council',
  version: '0.1.0',
  description: 'AI Council - Decision Audit Engine for Browser AI',
  permissions: [
    'activeTab',
    'storage',
    'tabs',
    'cookies'
  ],
  host_permissions: [
    'https://chatgpt.com/*',
    'https://chat.openai.com/*',
    'https://claude.ai/*',
    'https://ai.fakeopen.com/*',  // 反向代理
    'https://api.pawan.krd/*'     // 备用反向代理
  ],
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module'
  },
  content_scripts: [
    {
      matches: [
        'https://chatgpt.com/*',
        'https://claude.ai/*'
      ],
      js: ['src/content/index.ts'],
      run_at: 'document_idle'
    }
  ],
  action: {
    default_popup: 'src/popup.html'
  },
  options_ui: {
    page: 'src/options.html',
    open_in_tab: true
  }
} satisfies ManifestType
