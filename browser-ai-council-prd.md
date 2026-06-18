# Browser AI Council Bridge PRD

> 版本：v0.1  
> 日期：2026-06-17  
> 项目形态：pnpm monorepo，包含 NestJS 本地服务与 Chrome Extension 插件  
> 插件框架选型：CRXJS / `@crxjs/vite-plugin`  

---

## 1. 项目背景

当前目标是将用户已经在浏览器网页中可访问的 AI 服务，通过 Chrome 插件桥接到本地服务。插件不逆向各 AI 平台接口，不读取登录态，不接入各平台 API 登录流程，而是复用用户在网页上的正常登录状态，通过 DOM 自动化完成输入、发送、监听回复和结果回传。

本地服务只维护一个内部房间 `main`。房间中的多个 AI 被分配不同审计角色，对同一个方案进行结构化审计，持续发现隐藏问题、提出阻塞项、推动方案修订，直到所有 AI 对当前方案没有阻塞性反对意见，最终输出统一决策记录。

项目不应设计成普通多 Agent 聊天室，而应设计为“决策审计引擎”。

---

## 2. 核心目标

### 2.1 产品目标

1. 通过 Chrome 插件连接用户已登录的网页 AI。
2. 通过 WebSocket 将插件与本地 NestJS 服务连接。
3. 本地服务维护唯一内部房间 `main`。
4. 给每个网页 AI 分配审计角色。
5. 让多个 AI 围绕同一份 Proposal 进行结构化审计。
6. 通过阻塞问题账本 `Issue Ledger` 推动方案迭代。
7. 以“无阻塞异议”作为共识完成条件。
8. 最终输出可追踪的 Decision Record。

### 2.2 工程目标

1. 插件和服务端使用独立 app，但放在同一个 pnpm monorepo 中。
2. 服务端使用 NestJS。
3. 插件端使用 CRXJS + Vite + TypeScript。
4. 服务端和插件端共享 `packages/protocol`。
5. 协议消息使用 TypeScript 类型 + Zod schema 双重约束。
6. 插件不承担共识逻辑，只负责网页桥接。
7. 服务端不关心网页 DOM，只负责房间状态、调度和决策。

---

## 3. 框架选型对比

对比对象：

- Extension.js：https://github.com/extension-js/extension.js
- CRXJS Chrome Extension Tools：https://github.com/crxjs/chrome-extension-tools

### 3.1 Extension.js

Extension.js 是完整的跨浏览器扩展框架，提供创建、开发、构建、预览和打包能力。它强调 Chrome、Edge、Firefox 等多浏览器统一工作流，支持 TypeScript、React、Vue、Svelte、Preact，并且提供 Manifest 编译、浏览器特定输出、HMR、打包等能力。

适合场景：

1. 需要同时支持 Chrome、Edge、Firefox。
2. 希望尽量少维护 Vite/Rollup 插件配置。
3. 希望使用统一 CLI 完成创建、开发、构建、预览、打包。
4. 项目重点是跨浏览器发布，而不是深度控制构建细节。

主要优势：

1. 框架层更完整。
2. 跨浏览器输出能力更强。
3. CLI 体验统一。
4. 对新项目启动友好。
5. 官方文档覆盖较多，包括安全、性能、测试、CI、MV3 service worker 等主题。

主要风险：

1. 抽象层更高，遇到特殊构建问题时需要理解 Extension.js 自己的封装。
2. 对已有 pnpm monorepo + 自定义协议包 + 服务端联动的工程，可控性不如直接 Vite 插件清晰。
3. 当前项目第一阶段只做 Chrome，跨浏览器能力暂时不是首要收益。

### 3.2 CRXJS / `@crxjs/vite-plugin`

CRXJS 是围绕 Vite 的 Chrome Extension 构建工具，核心优势是让扩展项目直接使用 Vite 插件生态，支持 Manifest V3、HMR、静态资源导入、自动生成 web_accessible_resources 等能力。

适合场景：

1. 项目主要目标是 Chrome Extension。
2. 团队已经熟悉 Vite、TypeScript、React。
3. 希望插件工程与普通 Vite app 保持相似结构。
4. 需要在 pnpm monorepo 里和服务端、共享协议包协作。
5. 需要更直接地控制 manifest、content script、service worker、构建入口和调试逻辑。

主要优势：

1. 抽象层较低，工程可控。
2. 和 Vite 生态结合紧密。
3. 适合 Chrome-only 或 Chromium-first MVP。
4. 适合将插件作为 monorepo 中的一个 app。
5. 对当前项目的 service worker WebSocket、content script adapter、popup/options 页面开发足够。

主要风险：

1. 跨浏览器能力不如 Extension.js 的统一 CLI 明确。
2. 框架层能力较少，部分工程规范需要项目自己定义。
3. 如果后续明确支持 Firefox，需要额外评估 manifest 差异和构建输出。

### 3.3 选型结论

本项目 MVP 阶段选择：

```text
CRXJS + Vite + TypeScript
```

选择理由：

1. 当前核心目标是 Chrome 插件桥接本地服务，不是跨浏览器商店发布。
2. 项目需要和 NestJS 服务、共享协议包紧密配合，Vite 方式更直接。
3. 插件端需要可控地管理 service worker、content script、popup、options 和 manifest。
4. 本项目已有明确架构边界，不需要完整跨浏览器框架提供额外抽象。
5. 如果未来需要 Chrome + Firefox + Edge 多端发布，再评估迁移到 Extension.js 或引入多浏览器构建层。

---

## 4. 项目范围

### 4.1 范围内

1. Chrome 插件开发。
2. NestJS 本地服务。
3. 插件通过 WebSocket 连接本地服务。
4. 插件识别网页 AI 页面。
5. 插件对网页 AI 进行输入、发送、监听回复。
6. 本地服务维护唯一房间 `main`。
7. 本地服务分配 AI 审计角色。
8. 本地服务组织多轮审计。
9. 本地服务维护阻塞问题账本。
10. 本地服务输出最终决策记录。
11. SQLite 本地持久化。
12. 基础调试 UI。

### 4.2 范围外

1. 不逆向各 AI 平台接口。
2. 不读取 cookie、localStorage token、接口签名。
3. 不绕过登录、风控、付费限制。
4. 不做多用户系统。
5. 不做多房间系统。
6. 不做远程 SaaS 服务。
7. 不做 Native Messaging。
8. 不做自动发布 Chrome Web Store。
9. 不承诺所有网页 AI 通用适配。
10. 不在第一版支持 Firefox。

---

## 5. 用户角色

### 5.1 普通使用者

使用者已经登录多个网页 AI，希望将这些 AI 纳入一个本地决策房间，对某个服务、方案、架构或需求进行联合审计，得到更加稳健的决策结果。

### 5.2 开发者

开发者负责维护本地服务、插件适配器、AI 页面 DOM 选择器、消息协议和审计流程。

### 5.3 审计 AI

审计 AI 是网页 AI 的逻辑参与者，不是本地模型实例。每个审计 AI 被分配一个固定角色，例如架构审计、安全审计、实现审计、测试审计、反对者审计。

---

## 6. 核心用户流程

```text
1. 用户启动本地 NestJS 服务
2. 用户安装并启用 Chrome 插件
3. 插件 service worker 连接 ws://127.0.0.1:17321/ws
4. 用户打开多个已登录的网页 AI
5. content script 识别页面并注册 AI tab
6. 本地服务在 main 房间中创建 participants
7. 用户输入本次决策目标
8. 服务生成 Proposal v1
9. 服务根据角色生成审计 prompt
10. 插件将 prompt 分发到各 AI 网页
11. content script 操作页面发送 prompt
12. content script 监听 AI 输出完成
13. 插件将结果返回本地服务
14. 服务解析结构化审计结果
15. 服务合并 blocking issues
16. 如果存在阻塞项，服务生成 Proposal v2 并进入下一轮
17. 如果所有 AI 无阻塞异议，服务生成 Decision Record
18. 用户查看最终决策记录、风险说明和审计过程
```

---

## 7. 系统架构

```text
ai-council/
  apps/
    service/        # NestJS 本地服务
    extension/      # Chrome Extension，CRXJS + Vite
  packages/
    protocol/       # 共享协议、类型、schema、角色定义
```

运行架构：

```text
AI Web Pages
  ↓
Content Scripts
  ↓ chrome.runtime.Port / chrome.runtime.sendMessage
Extension Service Worker
  ↓ WebSocket
NestJS Local Service
  ↓
Room(main) / Participants / Rounds / Issue Ledger / Decision Record
```

---

## 8. 插件端需求

### 8.1 插件框架

插件端使用：

```text
CRXJS + Vite + TypeScript
```

推荐能力：

1. Manifest V3。
2. service worker。
3. content scripts。
4. popup 页面。
5. options 页面。
6. React 可选，MVP 可以先使用轻量 UI。
7. 共享 `@ai-council/protocol`。

### 8.2 Service Worker

Service Worker 负责：

1. 连接本地 WebSocket 服务。
2. 发送 `extension.hello`。
3. 保存连接状态。
4. 发送心跳。
5. 断线重连。
6. 接收服务端下发的 `ai.prompt.send`。
7. 按 participantId 找到目标 tab。
8. 将 prompt 转发给 content script。
9. 接收 content script 返回的 AI 回复。
10. 将 `ai.response.done` 或 `ai.response.error` 发送给本地服务。

### 8.3 Content Script

Content Script 负责：

1. 检测当前网页是否为支持的 AI 平台。
2. 判断页面是否可用或需要用户登录。
3. 将页面注册给 service worker。
4. 接收 prompt。
5. 写入网页输入框。
6. 触发发送动作。
7. 监听回复变化。
8. 判断回复完成。
9. 提取最终文本。
10. 回传结果。

Content Script 不负责：

1. 共识调度。
2. 角色分配。
3. proposal 修订。
4. issue 合并。
5. 决策完成判断。

### 8.4 Adapter 接口

```ts
export interface WebAIAdapter {
  provider: 'chatgpt' | 'claude' | 'gemini' | 'kimi' | 'doubao' | 'deepseek'
  detect(): boolean
  isReady(): Promise<boolean>
  sendPrompt(prompt: string): Promise<void>
  waitForResponse(options?: WaitResponseOptions): Promise<AIResponse>
  stopGeneration?(): Promise<void>
}
```

### 8.5 MVP 支持平台

第一版只支持：

1. ChatGPT 网页。
2. Claude 网页。

第二阶段再支持：

1. Gemini。
2. DeepSeek。
3. Kimi。
4. 豆包。

---

## 9. 服务端需求

### 9.1 服务端框架

服务端使用：

```text
NestJS + TypeScript
```

推荐模块：

```text
WsModule
RoomModule
ParticipantModule
ConsensusModule
IssueLedgerModule
ProposalModule
DecisionRecordModule
StorageModule
ConfigModule
```

### 9.2 WebSocket 服务

监听地址：

```text
127.0.0.1:17321
```

禁止默认监听：

```text
0.0.0.0
```

WebSocket 负责：

1. 插件连接鉴权。
2. 消息 schema 校验。
3. 消息路由。
4. participant 状态同步。
5. prompt 下发。
6. AI 结果接收。
7. 心跳检测。
8. 断线状态恢复。

### 9.3 唯一房间 main

```ts
interface Room {
  id: 'main'
  goal: string
  status: 'idle' | 'running' | 'reviewing' | 'approved' | 'blocked' | 'failed'
  participants: Participant[]
  currentProposal?: Proposal
  rounds: Round[]
  issueLedger: Issue[]
  decisionRecord?: DecisionRecord
}
```

### 9.4 Participant

```ts
interface Participant {
  id: string
  provider: string
  tabId: number
  role: AuditRole
  status: 'ready' | 'busy' | 'waiting' | 'login_required' | 'error' | 'offline'
  lastSeenAt: string
}
```

### 9.5 AuditRole

第一版角色：

1. 架构审计 AI。
2. 安全审计 AI。
3. 实现审计 AI。
4. 反对者 AI。

角色定义：

```ts
interface AuditRole {
  id: string
  name: string
  focus: string[]
  blockingCriteria: string[]
  outputSchema: string
}
```

### 9.6 Proposal

```ts
interface Proposal {
  id: string
  version: number
  goal: string
  summary: string
  assumptions: string[]
  design: string
  implementationPlan: string[]
  risks: string[]
  unresolvedIssues: string[]
  acceptanceCriteria: string[]
  createdAt: string
}
```

### 9.7 Issue Ledger

```ts
interface Issue {
  id: string
  proposalVersion: number
  raisedBy: string
  roleId: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'architecture' | 'security' | 'implementation' | 'product' | 'testability' | 'cost' | 'compliance' | 'unknown'
  description: string
  evidence?: string
  requiredChange?: string
  status: 'open' | 'resolved' | 'accepted_risk' | 'rejected'
  resolution?: string
  createdAt: string
  resolvedAt?: string
}
```

### 9.8 Round

```ts
interface Round {
  id: string
  index: number
  proposalVersion: number
  status: 'running' | 'completed' | 'failed'
  tasks: AuditTask[]
  startedAt: string
  completedAt?: string
}
```

### 9.9 共识完成条件

不是所有 AI 说“同意”就结束，而是满足：

```text
1. 所有必要 participant 均完成当前轮审计
2. 所有审计结果 decision 为 approve，或仅存在非阻塞建议
3. issueLedger 中不存在 open 状态的 high/critical blocking issue
4. 当前 Proposal 有明确 assumptions、risks、acceptanceCriteria
5. 当前轮没有解析失败、超时、空回复等未处理异常
```

### 9.10 最大轮次

默认最大轮次：

```text
3
```

可配置为：

```text
1 - 5
```

超过最大轮次仍未收敛，房间状态变为：

```text
blocked
```

并输出：

1. 当前 Proposal。
2. 未解决阻塞项。
3. 分歧来源。
4. 需要人工决策的问题。

---

## 10. 消息协议

所有消息必须经过 `packages/protocol` 定义。

### 10.1 extension.hello

```json
{
  "type": "extension.hello",
  "clientId": "browser-main",
  "extensionId": "chrome-extension-id",
  "version": "0.1.0",
  "pairingToken": "local-pairing-token"
}
```

### 10.2 ai.tab.register

```json
{
  "type": "ai.tab.register",
  "participantId": "chatgpt-main",
  "provider": "chatgpt",
  "tabId": 123,
  "url": "https://chatgpt.com/",
  "status": "ready"
}
```

### 10.3 ai.prompt.send

```json
{
  "type": "ai.prompt.send",
  "correlationId": "round-1-chatgpt",
  "participantId": "chatgpt-main",
  "payload": {
    "role": "security_auditor",
    "prompt": "..."
  }
}
```

### 10.4 ai.response.done

```json
{
  "type": "ai.response.done",
  "correlationId": "round-1-chatgpt",
  "participantId": "chatgpt-main",
  "payload": {
    "text": "...",
    "parsed": {
      "decision": "revise",
      "blocking_issues": [],
      "non_blocking_suggestions": [],
      "hidden_risks": [],
      "required_changes": [],
      "confidence": 0.82
    }
  }
}
```

### 10.5 ai.response.error

```json
{
  "type": "ai.response.error",
  "correlationId": "round-1-chatgpt",
  "participantId": "chatgpt-main",
  "error": {
    "code": "TIMEOUT",
    "message": "AI response timeout"
  }
}
```

---

## 11. 审计输出格式

每个 AI 必须返回 JSON。

```json
{
  "decision": "approve | revise | reject",
  "blocking_issues": [
    {
      "severity": "high",
      "category": "security",
      "description": "...",
      "required_change": "..."
    }
  ],
  "non_blocking_suggestions": [],
  "hidden_risks": [],
  "required_changes": [],
  "confidence": 0.8
}
```

解析失败时，服务端应自动进入一次“结构化修复”流程：

```text
1. 保存原始回复
2. 使用本地 parser 尝试提取 JSON
3. 若失败，生成格式修复 prompt
4. 重新要求同一 AI 只返回 JSON
5. 仍失败则标记该审计任务 failed
```

---

## 12. 安全要求

### 12.1 本地服务安全

1. 默认只监听 `127.0.0.1`。
2. WebSocket 必须鉴权。
3. 首次连接必须 pairing token。
4. 校验 `Origin`，只允许目标 Chrome extension origin。
5. 所有消息必须做 schema 校验。
6. 禁止提供无鉴权 HTTP 控制接口。
7. 禁止任意网页直接调用控制接口。
8. 所有任务必须有 `correlationId`。
9. 所有状态变更必须记录日志。

### 12.2 插件安全

1. 不读取 cookie。
2. 不读取 localStorage token。
3. 不 hook fetch / XHR 获取签名。
4. 不绕过登录。
5. 不绕过平台限制。
6. host_permissions 只配置明确支持的 AI 域名。
7. 默认不使用 `<all_urls>`。
8. popup/options 明确展示插件连接状态。
9. 用户可以禁用某个 AI 页面连接。
10. 采集内容只限于当前任务相关文本。

### 12.3 数据安全

1. 本地 SQLite 默认存储在用户本机。
2. 不上传远程服务器。
3. 决策记录可手动导出。
4. 支持清空历史记录。
5. 敏感任务提示用户确认后再发送给网页 AI。

---

## 13. 数据持久化

第一版使用 SQLite。

建议表：

```text
rooms
participants
proposals
rounds
audit_tasks
audit_results
issues
decision_records
connection_events
```

MVP 可以先只持久化：

1. proposals。
2. rounds。
3. audit_results。
4. issues。
5. decision_records。

---

## 14. 项目结构

```text
ai-council/
  apps/
    service/
      src/
        main.ts
        app.module.ts
        ws/
          ws.gateway.ts
          ws-auth.service.ts
          ws-message-router.ts
        room/
          room.module.ts
          room.service.ts
          room.state.ts
        participants/
          participant.module.ts
          participant.service.ts
        consensus/
          consensus.module.ts
          consensus.service.ts
          proposal.service.ts
          prompt-builder.service.ts
        issues/
          issue-ledger.module.ts
          issue-ledger.service.ts
        decision/
          decision-record.service.ts
        storage/
          storage.module.ts
          sqlite.service.ts

    extension/
      src/
        manifest.ts
        background/
          service-worker.ts
          local-ws-client.ts
          tab-registry.ts
          message-router.ts
        content/
          index.ts
          adapters/
            base.adapter.ts
            chatgpt.adapter.ts
            claude.adapter.ts
        popup/
          popup.html
          popup.tsx
        options/
          options.html
          options.tsx
      vite.config.ts
      package.json

  packages/
    protocol/
      src/
        index.ts
        messages.ts
        roles.ts
        room.ts
        issues.ts
        schemas.ts
      package.json

  pnpm-workspace.yaml
  package.json
  tsconfig.base.json
```

---

## 15. pnpm workspace 配置

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

根 `package.json`：

```json
{
  "name": "ai-council",
  "private": true,
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "dev:service": "pnpm --filter @ai-council/service dev",
    "dev:extension": "pnpm --filter @ai-council/extension dev",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck"
  }
}
```

---

## 16. MVP 里程碑

### M1：工程骨架

交付内容：

1. pnpm workspace。
2. NestJS service app。
3. CRXJS extension app。
4. protocol package。
5. typecheck/build 脚本。

验收标准：

1. `pnpm install` 成功。
2. `pnpm dev:service` 可启动服务。
3. `pnpm dev:extension` 可构建插件开发产物。
4. service 和 extension 都能引用 `@ai-council/protocol`。

### M2：WebSocket 链路

交付内容：

1. service WebSocket server。
2. extension service worker WebSocket client。
3. extension.hello。
4. ping/pong。
5. 断线重连。

验收标准：

1. 插件启动后自动连接本地服务。
2. 服务端能看到插件在线。
3. 关闭服务后插件显示断开。
4. 重启服务后插件可自动重连。

### M3：ChatGPT Adapter

交付内容：

1. ChatGPT 页面识别。
2. 页面 ready 检测。
3. prompt 输入。
4. 发送按钮触发。
5. 回复监听。
6. 回复完成判断。

验收标准：

1. 用户打开 ChatGPT 页面后，服务端能看到 participant。
2. 服务端下发 prompt 后，网页能自动输入并发送。
3. AI 回复完成后，服务端能收到文本。

### M4：Claude Adapter

交付内容同 M3。

验收标准同 M3。

### M5：单房间审计流程

交付内容：

1. main room。
2. participant 角色绑定。
3. proposal v1。
4. 审计 prompt 生成。
5. 多 participant 并行下发。
6. 审计结果收集。
7. JSON 解析。
8. issue ledger 合并。

验收标准：

1. 至少两个 AI 可以完成同一轮审计。
2. 服务端可以合并 blocking issues。
3. 服务端可以显示每个 AI 的审计结果。

### M6：共识与 Decision Record

交付内容：

1. 最大 3 轮审计。
2. proposal 修订。
3. open issue 检查。
4. approved / blocked 状态判断。
5. Decision Record 输出。

验收标准：

1. 无阻塞问题时输出 approved。
2. 超过最大轮次仍有阻塞问题时输出 blocked。
3. Decision Record 包含目标、最终方案、假设、风险、解决的问题、未解决的问题、验收标准。

---

## 17. 验收标准总表

| 模块 | 验收标准 |
|---|---|
| 工程 | pnpm monorepo 可安装、构建、类型检查 |
| 插件连接 | 插件 service worker 能连接本地 WebSocket |
| 安全 | 服务只监听 127.0.0.1，连接需要 pairing token |
| 页面识别 | 支持 ChatGPT、Claude 页面识别 |
| Prompt 下发 | 服务端可向指定 AI tab 下发 prompt |
| 回复采集 | 插件可监听 AI 回复并回传服务端 |
| 房间 | 服务端只有 main 房间 |
| 角色 | 每个 participant 可绑定审计角色 |
| 审计 | 审计结果可解析为结构化 JSON |
| 问题账本 | blocking issues 可合并、去重、关闭 |
| 共识 | 无 high/critical open issue 时通过 |
| 决策记录 | 可输出 Markdown 格式 Decision Record |

---

## 18. 风险与应对

### 18.1 网页 DOM 变更风险

风险：AI 网页改版后选择器失效。

应对：

1. 每个 adapter 独立维护。
2. 增加 health check。
3. 增加 selector fallback。
4. 增加手动调试面板。
5. 失败时明确提示 adapter broken。

### 18.2 AI 回复格式不稳定

风险：AI 不按 JSON 返回。

应对：

1. prompt 中强约束 JSON 输出。
2. 服务端做 JSON 提取。
3. 失败后做一次格式修复请求。
4. 连续失败后标记任务失败。

### 18.3 共识无法收敛

风险：多个 AI 反复提出不同意见。

应对：

1. 最大轮次限制。
2. 区分 blocking issue 和 non-blocking suggestion。
3. 允许 accepted_risk。
4. 超过轮次后输出 blocked，让人决策。

### 18.4 本地服务被滥用

风险：恶意网页尝试访问 localhost 服务。

应对：

1. 只监听 127.0.0.1。
2. WebSocket pairing token。
3. Origin 校验。
4. schema 校验。
5. 不开放无鉴权 HTTP 控制接口。

### 18.5 插件权限过大

风险：用户不信任插件。

应对：

1. 不使用 `<all_urls>`。
2. 仅声明支持的 AI 域名。
3. popup 展示当前连接页面。
4. 用户可关闭某个 tab 参与。
5. 文档明确不读取 cookie/token。

---

## 19. 后续版本规划

### v0.2

1. 支持 Gemini。
2. 支持 DeepSeek。
3. 支持可视化 Issue Ledger。
4. 支持 Decision Record 导出 Markdown。
5. 支持 adapter 调试模式。

### v0.3

1. 支持 proposal 自动修订策略配置。
2. 支持角色模板管理。
3. 支持审计 prompt 模板版本化。
4. 支持 Playwright E2E 测试插件行为。
5. 支持本地任务历史查询。

### v0.4

1. 支持 Electron 本地壳。
2. 支持自动启动本地服务。
3. 支持更完善的插件安装引导。
4. 评估 Extension.js 或其他方案支持多浏览器发布。

---

## 20. 参考资料

1. Extension.js GitHub：https://github.com/extension-js/extension.js
2. Extension.js 文档：https://extension.js.org/docs
3. CRXJS GitHub：https://github.com/crxjs/chrome-extension-tools
4. CRXJS 文档：https://crxjs.dev/
5. Chrome Extension WebSocket in service workers：https://developer.chrome.com/docs/extensions/how-to/web-platform/websockets
6. Chrome Extension content scripts：https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
