# 计划：AI Council 决策 API 服务

## 摘要

为 AI Council 服务添加外部决策 API，允许外部系统传入决策需求，房间中的 AI 参与者自动协作完成决策，并将各方意见汇总返回。同时集成 Swagger API 文档。

## 当前状态分析

现有系统已有：
- ✅ WebSocket 服务 (`main.ts`)
- ✅ 房间管理 (`RoomService`, `RoomModule`)
- ✅ 参与者管理 (`ParticipantService`)
- ✅ MCP 工具服务 (`McpToolsService`) - 部分实现
- ✅ 共识服务 (`ConsensusService`)
- ✅ 决策记录 (`DecisionRecordService`)
- ❌ Swagger API 文档
- ❌ 外部决策 API 端点
- ❌ AI 自动加入房间机制
- ❌ 决策请求分发到所有 AI
- ❌ 决策结果汇总机制

## Proposed Changes

### 1. 安装 Swagger 依赖

**文件**: `apps/service/package.json`

添加 Swagger 相关依赖：
```json
{
  "@nestjs/swagger": "^8.0.0",
  "swagger-ui-express": "^5.0.0"
}
```

### 2. 配置 Swagger

**文件**: `apps/service/src/main.ts`

在 Fastify 适配器中配置 Swagger：
```typescript
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new FastifyAdapter({...}))

  // Swagger 配置
  const config = new DocumentBuilder()
    .setTitle('AI Council API')
    .setDescription('AI Council - 浏览器 AI 决策审计引擎 API')
    .setVersion('0.1.0')
    .addTag('decision', '决策管理')
    .addTag('room', '房间管理')
    .addTag('participant', '参与者管理')
    .addTag('mcp', 'MCP 工具')
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, document)

  await app.listen(port)
}
```

### 3. 新增决策 API 控制器

**文件**: `apps/service/src/decision-api/decision-api.controller.ts`

创建 REST API 端点，使用 Swagger 装饰器：
- `POST /api/decision/request` - 提交决策请求
- `GET /api/decision/:id` - 获取决策结果
- `GET /api/decision/:id/status` - 获取决策状态

**API 请求格式**:
```json
{
  "roomId": "room_xxx",
  "task": "需要AI决策的业务逻辑描述",
  "context": {
    "relevant_data": "..."
  },
  "options": {
    "collectOpinions": true,
    "requireConsensus": false,
    "timeoutMs": 60000
  }
}
```

**API 响应格式**:
```json
{
  "decisionId": "decision_xxx",
  "status": "pending|processing|completed",
  "results": {
    "chatgpt": {
      "opinion": "ChatGPT的意见",
      "confidence": 0.85
    },
    "claude": {
      "opinion": "Claude的意见",
      "confidence": 0.90
    }
  },
  "summary": "汇总后的决策"
}
```

### 4. 新增决策请求服务

**文件**: `apps/service/src/decision-api/decision-request.service.ts`

职责：
- 管理决策请求生命周期
- 向房间中的所有在线参与者分发决策任务
- 收集各参与者的响应
- 超时处理
- 结果汇总

**核心方法**:
```typescript
class DecisionRequestService {
  // 提交决策请求
  submitDecisionRequest(request: DecisionRequest): Promise<DecisionResponse>

  // 获取决策状态
  getDecisionStatus(id: string): DecisionStatus

  // 获取决策结果
  getDecisionResult(id: string): DecisionResult

  // 内部：向所有参与者分发任务
  private distributeToParticipants(requestId: string, task: string, context: any): Promise<void>

  // 内部：收集参与者响应
  private collectResponses(requestId: string, timeoutMs: number): Promise<Map<string, ParticipantResponse>>

  // 内部：汇总结果
  private summarizeResults(requestId: string): Promise<string>
}
```

### 3. 新增决策请求服务

**文件**: `apps/service/src/decision-api/decision-request.service.ts`

职责：
- 管理决策请求生命周期
- 向房间中的所有在线参与者分发决策任务
- 收集各参与者的响应
- 超时处理
- 结果汇总

**核心方法**:
```typescript
class DecisionRequestService {
  // 提交决策请求
  submitDecisionRequest(request: DecisionRequest): Promise<DecisionResponse>

  // 获取决策状态
  getDecisionStatus(id: string): DecisionStatus

  // 获取决策结果
  getDecisionResult(id: string): DecisionResult

  // 内部：向所有参与者分发任务
  private distributeToParticipants(requestId: string, task: string, context: any): Promise<void>

  // 内部：收集参与者响应
  private collectResponses(requestId: string, timeoutMs: number): Promise<Map<string, ParticipantResponse>>

  // 内部：汇总结果
  private summarizeResults(requestId: string): Promise<string>
}
```

### 5. 修改 AI 加入房间机制

**文件**: `apps/service/src/ws/ws-message-router.service.ts`

在 `registerConnection` 方法中添加：
- 检查参与者是否有预分配的房间
- 如果有，自动调用 `roomService.addParticipant()`
- 发送 `room.joined` 消息通知客户端

**新增消息类型**:
- `room.joined` - 通知AI已成功加入房间
- `decision.distribute` - 通知AI收到新的决策任务
- `decision.collect` - 通知AI提交决策意见

### 6. 新增决策模块

**文件**: `apps/service/src/decision-api/decision-api.module.ts`

整合控制器和服务：
```typescript
@Module({
  imports: [RoomModule, ParticipantModule, WsModule],
  controllers: [DecisionApiController],
  providers: [DecisionRequestService]
})
export class DecisionApiModule {}
```

### 7. 更新 AppModule

**文件**: `apps/service/src/app.module.ts`

导入新的决策模块：
```typescript
import { DecisionApiModule } from './decision-api/decision-api.module'

@Module({
  imports: [
    // ... existing
    DecisionApiModule
  ]
})
export class AppModule {}
```

### 8. 扩展 MCP 工具

**文件**: `apps/service/src/mcp/mcp-tools.service.ts`

新增 MCP 工具：
- `decision_submit` - 提交决策请求（与 REST API 相同）
- `decision_status` - 查询决策状态
- `decision_result` - 获取决策结果

### 9. 扩展 WebSocket 消息

**文件**: `apps/service/src/main.ts`

在 `handleMessage` 函数中添加：
```typescript
case 'decision.submit':
  // 处理决策提交
  this.wsMessageRouter.handleDecisionSubmit(clientId, data)
  break

case 'decision.opinion':
  // 收集 AI 的决策意见
  this.wsMessageRouter.handleDecisionOpinion(clientId, data)
  break
```

## 实施步骤

### 步骤 1: 安装 Swagger 依赖
1. 添加 `@nestjs/swagger` 和 `swagger-ui-express` 到 `package.json`
2. 运行 `pnpm install`

### 步骤 2: 配置 Swagger
1. 在 `main.ts` 中导入 `SwaggerModule`, `DocumentBuilder`
2. 配置 API 标题、描述、版本
3. 添加决策、房间、参与者等标签

### 步骤 3: 创建决策 DTO
1. 创建 `dto/decision.dto.ts`
2. 添加 Swagger 装饰器 (`@ApiProperty`, `@ApiPropertyOptional`)

### 步骤 4: 创建决策请求服务
1. 创建 `decision-request.service.ts`
2. 实现决策请求提交逻辑
3. 实现向参与者分发任务
4. 实现结果收集和汇总

### 步骤 5: 创建决策 API 控制器
1. 创建 `decision-api.controller.ts`
2. 使用 `@ApiTags('decision')` 装饰器
3. 实现 `POST /api/decision/request`
4. 实现 `GET /api/decision/:id`
5. 实现 `GET /api/decision/:id/status`

### 步骤 6: 创建决策 API 模块
1. 创建 `decision-api.module.ts`
2. 整合服务和控制器

### 步骤 7: 修改 AI 加入房间机制
1. 修改 `registerConnection` 方法
2. 添加自动加入房间逻辑
3. 添加 `room.joined` 消息通知

### 步骤 8: 更新 main.ts WebSocket 消息处理
1. 添加 `decision.submit` 处理
2. 添加 `decision.opinion` 处理

### 步骤 9: 扩展 MCP 工具
1. 添加 `decision_submit` 工具
2. 添加 `decision_status` 工具
3. 添加 `decision_result` 工具

### 步骤 10: 更新 AppModule
1. 导入 DecisionApiModule

### 步骤 11: 测试和验证
1. 构建服务
2. 访问 `http://localhost:17321/api/docs` 查看 Swagger 文档
3. 测试 API 端点
4. 测试 WebSocket 消息流
5. 测试 MCP 工具

## 决策流程图

```
外部系统
    │
    │ POST /api/decision/request
    ▼
┌─────────────────────────────────────────┐
│         DecisionRequestService           │
│  1. 创建决策请求记录                      │
│  2. 获取房间中的所有参与者                 │
│  3. 向每个参与者发送决策任务               │
└─────────────────┬───────────────────────┘
                  │
                  │ WebSocket: decision.distribute
                  ▼
        ┌─────────────────────┐
        │  ChatGPT Extension   │
        │  Claude Extension    │
        │  Kimi Extension      │  ...
        └──────────┬──────────┘
                   │
                   │ 等待AI响应
                   ▼
        ┌─────────────────────┐
        │  WebSocket:          │
        │  decision.opinion    │
        └──────────┬──────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│         DecisionRequestService           │
│  1. 收集所有参与者的意见                  │
│  2. 汇总各方决策                         │
│  3. 更新决策状态为 completed             │
└─────────────────┬───────────────────────┘
                  │
                  │ 返回决策结果
                  ▼
外部系统 (GET /api/decision/:id)
```

## 假设与决策

1. **房间预先存在**: 假设房间已经通过其他方式创建，AI 连接后自动加入
2. **决策请求格式**: 使用统一的 task + context 结构，支持灵活的业务逻辑
3. **结果汇总**: 目前采用简单的文本汇总，后续可扩展为 LLM 汇总
4. **超时处理**: 60秒默认超时，超时返回部分结果
5. **参与者筛选**: 可选择性地只让部分 AI 参与决策

## 验证步骤

1. ✅ 服务构建成功
2. ✅ `POST /api/decision/request` 返回决策ID
3. ✅ AI 连接到 WebSocket 后自动加入房间
4. ✅ 决策请求被分发到所有在线 AI
5. ✅ 收集到各 AI 的响应后返回汇总结果
6. ✅ MCP 工具 `decision_submit` 可正常工作
