import type { ManifestType } from '@crxjs/vite-plugin'

// 所有支持的 AI 平台 URL
const AI_PLATFORM_URLS = [
  // ChatGPT
  'https://chatgpt.com/*',
  'https://chat.openai.com/*',
  // Claude
  'https://claude.ai/*',
  'https://claudeaude.com/*',
  // 通义千问
  'https://qianwen.aliyun.com/*',
  'https://tongyi.aliyun.com/*',
  // DeepSeek
  'https://chat.deepseek.com/*',
  'https://deepseek.com/*',
  // Kimi
  'https://kimi.moonshot.cn/*',
  // GLM / 智谱清言
  'https://chat.z.ai/*',
  'https://www.zhipuai.cn/*',
  // 其他常用 AI 平台
  'https://copilot.microsoft.com/*',
  'https://www.bing.com/*'
]

export default {
  manifest_version: 3,
  name: 'AI Council',
  version: '0.1.0',
  description: 'AI Council - 浏览器 AI 决策审计引擎',
  permissions: [
    'activeTab',
    'storage',
    'tabs',
    'cookies',
    'webNavigation',
    'webRequest'
  ],
  host_permissions: AI_PLATFORM_URLS,
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module'
  },
  content_scripts: [
    {
      matches: AI_PLATFORM_URLS,
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
      all_frames: true
    }
  ],
  action: {
    default_popup: 'src/popup.html'
  },
  options_ui: {
    page: 'src/options.html',
    open_in_tab: true
  },
  web_accessible_resources: [
    {
      resources: ['assets/*'],
      matches: ['<all_urls>']
    }
  ]
} satisfies ManifestType
