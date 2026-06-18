# AI Council

浏览器 AI 决策审计引擎 - 多 AI 模型协作决策系统

## 项目简介

AI Council 是一个 Chrome 扩展 + 后端服务架构的多 AI 模型协作平台。通过监控和协调多种 AI 模型（如 ChatGPT、Claude、通义千问、DeepSeek、Kimi、GLM 等）的决策过程，实现更可靠的 AI 决策审计和多方协商机制。

### 核心特性

- 🤖 **多 AI 模型支持**: 支持 ChatGPT、Claude、通义千问、DeepSeek、Kimi、GLM 等主流 AI 平台
- 🔗 **实时 WebSocket 通信**: 扩展与服务端之间的高速双向通信
- 📊 **决策审计**: 记录和追溯每个 AI 模型的决策过程
- 🏠 **房间管理**: 创建虚拟房间，组织多个 AI 模型参与讨论
- 🔒 **隐私优先**: 所有数据本地存储，不上传用户对话内容

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Chrome 浏览器                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  扩展 Popup  │  │ Settings 页 │  │    Content Scripts   │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                     │            │
│         └────────────────┴─────────────────────┘            │
│                          │                                  │
│              ┌───────────┴───────────┐                      │
│              │    Service Worker     │                      │
│              │   (WebSocket Client)  │                      │
│              └───────────┬───────────┘                      │
└──────────────────────────┼──────────────────────────────────┘
                           │ WebSocket
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              NestJS 后端服务                          │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────────────┐    │    │
│  │  │ WS Gateway│  │ Consensus│  │ Room Management │    │    │
│  │  └─────────┘  └─────────┘  └─────────────────┘    │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────────────┐    │    │
│  │  │ Storage  │  │ Issues  │  │    Decisions    │    │    │
│  │  └─────────┘  └─────────┘  └─────────────────┘    │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│              ┌─────────────────────┐                        │
│              │    SQLite 数据库      │                        │
│              └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## 项目结构

```
ai-council/
├── apps/
│   ├── extension/          # Chrome 扩展
│   │   ├── src/
│   │   │   ├── background/     # Service Worker
│   │   │   │   ├── local-ws-client.ts    # WebSocket 客户端
│   │   │   │   ├── message-router.ts      # 消息路由
│   │   │   │   ├── service-worker.ts       # 入口
│   │   │   │   ├── chatgpt-api.ts          # ChatGPT API
│   │   │   │   ├── claude-api.ts           # Claude API
│   │   │   │   ├── glm-api.ts              # GLM API
│   │   │   │   └── tab-registry.ts         # Tab 注册表
│   │   │   ├── content/        # Content Scripts
│   │   │   ├── popup/          # 弹窗 UI
│   │   │   ├── options/        # 设置页面
│   │   │   └── styles/         # 样式文件
│   │   └── dist/               # 构建输出
│   │
│   └── service/            # NestJS 后端服务
│       └── src/
│           ├── main.ts             # 入口
│           ├── app.module.ts      # 根模块
│           ├── ws/                # WebSocket 模块
│           │   ├── ws.gateway.ts
│           │   ├── ws-message-router.service.ts
│           │   ├── ws-auth.service.ts
│           │   └── ws-sender.service.ts
│           ├── consensus/          # 共识模块
│           ├── decision/          # 决策记录模块
│           ├── issues/            # 问题追踪模块
│           ├── participants/     # 参与者管理
│           ├── room/             # 房间管理
│           └── storage/           # SQLite 存储
│
├── packages/
│   └── protocol/            # 共享协议定义
│       └── src/
│           └── index.ts     # 类型定义
│
├── node_modules/
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Chrome 浏览器（用于加载扩展）

### 安装依赖

```bash
# 安装所有依赖
pnpm install
```

### 开发模式

```bash
# 启动后端服务（开发模式，热重载）
pnpm dev:service

# 在另一个终端启动扩展开发服务器
pnpm dev:extension
```

### 构建

```bash
# 构建所有项目
pnpm build

# 仅构建扩展
pnpm build:extension

# 仅构建后端服务
pnpm build:service
```

### 运行后端服务

```bash
cd apps/service
node dist/main.js
```

服务将在 `http://localhost:17321` 启动，WebSocket 监听 `/ws` 路径。

### 加载 Chrome 扩展

1. 打开 Chrome，进入 `chrome://extensions/`
2. 开启右上角的"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `apps/extension/dist` 目录

## 配置说明

### 扩展设置

在扩展的设置页面可以配置：

- **服务地址**: 后端服务地址，默认 `http://localhost:17321`
- **AI 提供商**: 需要授权的 AI 平台

### 支持的 AI 提供商

| 提供商 | 授权地址 |
|--------|----------|
| ChatGPT (OpenAI) | https://chat.openai.com |
| Claude (Anthropic) | https://claude.ai |
| 通义千问 (阿里云) | https://qianwen.aliyun.com |
| DeepSeek | https://chat.deepseek.com |
| Kimi (月之暗面) | https://kimi.moonshot.cn |
| GLM (智谱清言) | https://chat.z.ai |

## API 参考

### WebSocket 消息协议

#### 客户端 → 服务端

| 消息类型 | 说明 | 字段 |
|---------|------|------|
| `extension.hello` | 扩展注册 | `version`, `capabilities` |
| `ai.tab.register` | 注册 AI Tab | `participantId`, `provider`, `tabId`, `url` |
| `ai.tab.status` | 更新 Tab 状态 | `participantId`, `status` |
| `ai.prompt.execute` | 执行提示词 | `correlationId`, `participantId`, `task` |
| `ai.response.done` | 响应完成 | `correlationId`, `participantId`, `text` |
| `room.create` | 创建房间 | `name`, `description` |
| `room.join` | 加入房间 | `roomId` |
| `room.leave` | 离开房间 | `roomId` |

#### 服务端 → 客户端

| 消息类型 | 说明 | 字段 |
|---------|------|------|
| `connected` | 连接成功 | `clientId`, `timestamp` |
| `extension.pong` | 注册响应 | `version`, `timestamp` |
| `auth.refreshed` | 认证刷新 | `provider`, `success` |
| `room.status` | 房间状态 | 房间相关信息 |

### REST API

| 端点 | 方法 | 说明 |
|------|------|------|
| `GET /api/health` | GET | 健康检查 |
| `GET /api/rooms` | GET | 获取所有房间 |
| `POST /api/rooms` | POST | 创建房间 |
| `GET /api/rooms/:id` | GET | 获取房间详情 |
| `DELETE /api/rooms/:id` | DELETE | 删除房间 |

## 数据库

使用 SQLite 存储数据，主要表结构：

### participants
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| participant_id | TEXT | 参与者唯一 ID |
| name | TEXT | 名称 |
| provider | TEXT | AI 提供商 |
| model | TEXT | 模型名称 |
| status | TEXT | 在线状态 |
| created_at | INTEGER | 创建时间 |

### issues
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| issue_id | TEXT | 问题唯一 ID |
| room_id | TEXT | 所属房间 |
| title | TEXT | 问题标题 |
| description | TEXT | 问题描述 |
| status | TEXT | 状态 |
| created_at | INTEGER | 创建时间 |

### decisions
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| decision_id | TEXT | 决策唯一 ID |
| issue_id | TEXT | 关联问题 |
| participant_id | TEXT | 参与者 |
| conclusion | TEXT | 结论 |
| reasoning | TEXT | 推理过程 |
| confidence | REAL | 置信度 |
| created_at | INTEGER | 创建时间 |

## 开发指南

### 添加新的 AI 提供商

1. 在 `packages/protocol/src/index.ts` 添加新的 Provider 类型
2. 在 `apps/extension/src/background/` 创建新的 API 客户端文件
3. 在 `message-router.ts` 添加对应的消息处理
4. 在 `SettingsPanel.vue` 添加提供商配置

### 添加新的 WebSocket 消息

1. 在 `apps/service/src/main.ts` 添加消息处理 case
2. 在 `apps/extension/src/background/message-router.ts` 添加对应的客户端处理

## 技术栈

### 扩展端
- TypeScript
- Vue 3 (设置页面)
- Vite (构建工具)
- 原生 WebSocket API
- Chrome Extension APIs

### 服务端
- TypeScript
- NestJS 11 (框架)
- Fastify (HTTP 底座)
- ws (WebSocket)
- SQLite + better-sqlite3

### 共享
- pnpm (包管理)
- TypeScript (类型系统)

## License

MIT
