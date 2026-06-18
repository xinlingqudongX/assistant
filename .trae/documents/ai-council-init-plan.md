# AI Council 项目初始化计划

## 1. Summary

基于 PRD 文档，建立 `ai-council` pnpm monorepo 项目：
- **apps/service**: NestJS 本地服务，监听 `127.0.0.1:17321`
- **apps/extension**: Chrome Extension (CRXJS + Vite + Vue + TypeScript)
- **packages/protocol**: 共享协议、类型、Zod schema

M1 里程碑：工程骨架 + ChatGPT/Claude 双 Adapter

---

## 2. Current State

- 无现有代码，全新创建
- PRD 已上传，提供完整需求

---

## 3. Proposed Changes

### 3.1 根目录配置

| 文件 | 操作 | 说明 |
|------|------|------|
| `ai-council/pnpm-workspace.yaml` | 创建 | 定义 workspace 包路径 |
| `ai-council/package.json` | 创建 | 根 package.json，定义 workspace scripts |
| `ai-council/tsconfig.base.json` | 创建 | 基础 TypeScript 配置 |
| `ai-council/.npmrc` | 创建 | pnpm 配置 (shamefully-hoist) |
| `ai-council/.gitignore` | 创建 | Git 忽略规则 |

### 3.2 packages/protocol

| 文件 | 操作 | 说明 |
|------|------|------|
| `package.json` | 创建 | 包名 `@ai-council/protocol`，依赖 zod |
| `tsconfig.json` | 创建 | TypeScript 配置 |
| `src/index.ts` | 创建 | 统一导出入口 |
| `src/messages.ts` | 创建 | 所有协议消息类型 |
| `src/schemas.ts` | 创建 | Zod schema 定义 |
| `src/roles.ts` | 创建 | 4 个审计角色定义 |
| `src/room.ts` | 创建 | Room/Participant/Round 类型 |
| `src/issues.ts` | 创建 | Issue/IssueLedger 类型 |
| `src/proposal.ts` | 创建 | Proposal 类型 |
| `src/audit.ts` | 创建 | AuditResult 类型 |

### 3.3 apps/service

| 文件 | 操作 | 说明 |
|------|------|------|
| `package.json` | 创建 | NestJS 依赖配置 |
| `nest-cli.json` | 创建 | NestJS CLI 配置 |
| `tsconfig.json` | 创建 | TypeScript 配置 |
| `tsconfig.build.json` | 创建 | 构建用 tsconfig |
| `src/main.ts` | 创建 | 入口，监听 127.0.0.1:17321 |
| `src/app.module.ts` | 创建 | 根模块 |
| `src/ws/ws.module.ts` | 创建 | WebSocket 模块 |
| `src/ws/ws.gateway.ts` | 创建 | WebSocket 网关 |
| `src/ws/ws-auth.service.ts` | 创建 | 鉴权服务 |
| `src/ws/ws-message-router.service.ts` | 创建 | 消息路由 |
| `src/room/room.module.ts` | 创建 | 房间模块 |
| `src/room/room.service.ts` | 创建 | 房间服务 |
| `src/room/room.state.ts` | 创建 | 房间状态管理 |
| `src/participants/participant.module.ts` | 创建 | 参与者模块 |
| `src/participants/participant.service.ts` | 创建 | 参与者服务 |
| `src/consensus/consensus.module.ts` | 创建 | 共识模块 |
| `src/consensus/consensus.service.ts` | 创建 | 共识服务 |
| `src/consensus/proposal.service.ts` | 创建 | Proposal 服务 |
| `src/consensus/prompt-builder.service.ts` | 创建 | Prompt 构建服务 |
| `src/issues/issue-ledger.module.ts` | 创建 | 问题账本模块 |
| `src/issues/issue-ledger.service.ts` | 创建 | 问题账本服务 |
| `src/decision/decision.module.ts` | 创建 | 决策模块 |
| `src/decision/decision-record.service.ts` | 创建 | 决策记录服务 |
| `src/storage/storage.module.ts` | 创建 | 存储模块 |
| `src/storage/sqlite.service.ts` | 创建 | SQLite 服务 |

### 3.4 apps/extension

| 文件 | 操作 | 说明 |
|------|------|------|
| `package.json` | 创建 | CRXJS/Vite/Vue 依赖 |
| `vite.config.ts` | 创建 | Vite + CRXJS 配置 |
| `tsconfig.json` | 创建 | TypeScript 配置 |
| `src/manifest.ts` | 创建 | Manifest V3 配置 |
| `public/popup.html` | 创建 | Popup 入口 HTML |
| `public/options.html` | 创建 | Options 入口 HTML |
| `src/background/service-worker.ts` | 创建 | Service Worker 入口 |
| `src/background/local-ws-client.ts` | 创建 | WebSocket 客户端 |
| `src/background/tab-registry.ts` | 创建 | Tab 注册表 |
| `src/background/message-router.ts` | 创建 | 消息路由 |
| `src/content/index.ts` | 创建 | Content Script 入口 |
| `src/content/base.adapter.ts` | 创建 | 适配器基类 |
| `src/content/chatgpt.adapter.ts` | 创建 | ChatGPT 适配器 |
| `src/content/claude.adapter.ts` | 创建 | Claude 适配器 |
| `src/popup/main.ts` | 创建 | Popup 入口 |
| `src/popup/App.vue` | 创建 | Popup 主组件 |
| `src/popup/components/StatusPanel.vue` | 创建 | 状态面板组件 |
| `src/popup/components/ParticipantList.vue` | 创建 | 参与者列表组件 |
| `src/options/main.ts` | 创建 | Options 入口 |
| `src/options/App.vue` | 创建 | Options 主组件 |
| `src/options/components/SettingsPanel.vue` | 创建 | 设置面板组件 |
| `public/icons/icon16.png` | 创建 | 图标 (占位) |
| `public/icons/icon48.png` | 创建 | 图标 (占位) |
| `public/icons/icon128.png` | 创建 | 图标 (占位) |

---

## 4. 验收标准

| 检查项 | 验证方式 |
|--------|----------|
| `pnpm install` 成功 | 执行命令，无报错 |
| `pnpm dev:service` 启动服务 | 服务监听 127.0.0.1:17321 |
| `pnpm dev:extension` 构建插件 | 生成 dist/ 目录 |
| typecheck 通过 | `pnpm typecheck` 无报错 |
| service 引用 protocol | import `@ai-council/protocol` 成功 |
| extension 引用 protocol | import `@ai-council/protocol` 成功 |

---

## 5. 执行顺序

```
1. 创建根目录 + workspace 配置
2. 创建 packages/protocol (先构建，其他包依赖它)
3. 创建 apps/service (NestJS 基础结构)
4. 创建 apps/extension (CRXJS + Vue + 双 Adapter)
5. 验证安装和构建
```

---

## 6. 技术细节

### 6.1 端口绑定
- Service: `127.0.0.1:17321` (禁止 0.0.0.0)

### 6.2 Extension Manifest V3
- host_permissions: `https://chatgpt.com/*`, `https://claude.ai/*`
- 不使用 `<all_urls>`

### 6.3 WebSocket 鉴权
- 需要 pairing token
- 校验 Origin

### 6.4 审计角色 (M1 预定义)
1. architecture_auditor
2. security_auditor
3. implementation_auditor
4. devil_advocate

---

## 7. Assumption

- Node >= 18, pnpm >= 8
- 用户已安装 pnpm
- MVP 阶段不包含 SQLite 持久化（M2 阶段）
- MVP 阶段 WebSocket 只实现基础连接，不包含完整审计流程（M5 阶段）
