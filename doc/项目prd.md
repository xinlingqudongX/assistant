项目选型结论：

本项目 MVP 阶段采用 CRXJS + Vite + TypeScript 开发 Chrome Extension，采用 NestJS 开发本地服务，二者通过 WebSocket 通信，并通过 pnpm workspace 下的 packages/protocol 共享消息协议、角色定义和 schema。

Extension.js 作为后续跨浏览器发布的备选方案保留。当项目进入 Chrome、Edge、Firefox 多浏览器统一发布阶段时，再重新评估是否迁移到 Extension.js。
