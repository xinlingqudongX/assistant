import { NestFactory } from '@nestjs/core'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { WebSocketServer as WsWebSocketServer } from 'ws'
import { WsMessageRouterService } from './ws/ws-message-router.service'
import { WsSenderService } from './ws/ws-sender.service'
import { ExtensionMessageService } from './ws/extension-message.service'
import { DecisionRequestService } from './decision-api/decision-request.service'

// 全局 WebSocket 服务器引用和客户端映射
let wss: WsWebSocketServer | null = null
const clients = new Map<string, any>()

export function getWss(): WsWebSocketServer | null {
  return wss
}

export function getClient(clientId: string): any {
  return clients.get(clientId)
}

export function getAllClients(): Map<string, any> {
  return clients
}

/**
 * 向所有连接的客户端广播消息
 */
export function broadcastToAll(message: object): void {
  if (!wss) return

  const payload = JSON.stringify(message)
  for (const [, client] of clients) {
    try {
      if (client.readyState === 1) { // OPEN
        client.send(payload)
      }
    } catch (error) {
      console.error('[Broadcast] Failed to send to client:', error)
    }
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new FastifyAdapter({
    logger: false
  }))

  // 启用 CORS
  await app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true
  })

  // 配置 Swagger
  setupSwagger(app)

  // 等待 NestJS 完全启动
  await app.init()

  const port = process.env.PORT || 17321
  const httpServer = app.getHttpServer()

  // 初始化 WebSocket 服务器
  wss = new WsWebSocketServer({ server: httpServer, path: '/ws' })

  // 获取 WsMessageRouterService 实例
  const messageRouter = app.get(WsMessageRouterService)
  const wsSender = app.get(WsSenderService)
  const extensionMessageService = app.get(ExtensionMessageService)
  const decisionRequestService = app.get(DecisionRequestService)

  // 注册 gateway：把 WsSenderService 桥接到原生 WebSocket 的 client map / 广播函数
  wsSender.registerGateway({
    sendToClient: (clientId: string, message: any): boolean => {
      const client = clients.get(clientId)
      if (!client || client.readyState !== 1) {
        return false
      }
      try {
        client.send(typeof message === 'string' ? message : JSON.stringify(message))
        return true
      } catch (error) {
        console.error('[WsSender] sendToClient failed:', error)
        return false
      }
    },
    broadcast: (_event: string, data: any): void => {
      broadcastToAll(typeof data === 'string' ? JSON.parse(data) : data)
    }
  })

  setupWebSocket(messageRouter, extensionMessageService, decisionRequestService)

  await app.listen(port)

  console.log(`AI Council Service running on http://localhost:${port}`)
  console.log(`WebSocket available at ws://localhost:${port}/ws`)
  console.log(`Swagger API docs available at http://localhost:${port}/api/docs`)
}

function setupSwagger(app: any) {
  const config = new DocumentBuilder()
    .setTitle('AI Council API')
    .setDescription('AI Council - 浏览器 AI 决策审计引擎 API\n\n支持的功能：\n- 房间管理\n- 参与者管理\n- 问题追踪\n- 决策记录\n- MCP 工具')
    .setVersion('0.1.0')
    .addTag('mcp', 'MCP 工具 - Model Context Protocol')
    .addTag('decision', '决策 API - 向 AI 参与者发起决策请求')
    .addTag('health', '健康检查')
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      showRequestDuration: true
    },
    customSiteTitle: 'AI Council API Documentation'
  })
}

function setupWebSocket(
  messageRouter: WsMessageRouterService,
  extensionMessageService: ExtensionMessageService,
  decisionRequestService: DecisionRequestService
) {
  wss!.on('connection', (ws, req) => {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    console.log(`[WsGateway] Client connecting: ${clientId}`)

    // 存储客户端连接
    clients.set(clientId, ws)

    // 注册连接
    messageRouter.registerConnection(clientId, {
      clientId,
      userId: 'anonymous',
      connectedAt: Date.now()
    })

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())
        console.log(`[WsGateway] Message from ${clientId}:`, message.type)
        handleMessage(ws, clientId, message, messageRouter, extensionMessageService, decisionRequestService)
      } catch (error) {
        console.error('[WsGateway] Failed to parse message:', error)
      }
    })

    ws.on('close', () => {
      clients.delete(clientId)
      messageRouter.unregisterConnection(clientId)
      console.log(`[WsGateway] Client disconnected: ${clientId}`)
    })

    ws.on('error', (error) => {
      console.error(`[WsGateway] WebSocket error for ${clientId}:`, error)
    })

    // 发送连接成功消息
    ws.send(JSON.stringify({
      type: 'connected',
      clientId,
      timestamp: Date.now()
    }))
  })

  console.log('[WsGateway] WebSocket Gateway initialized on /ws')
}

function handleMessage(
  ws: any,
  clientId: string,
  message: any,
  messageRouter: WsMessageRouterService,
  extensionMessageService: ExtensionMessageService,
  decisionRequestService: DecisionRequestService
) {
  const { type, ...data } = message

  // 路由消息到对应的处理函数
  switch (type) {
    case 'extension.hello':
      messageRouter.updateClientCapabilities(clientId, data.capabilities || [])
      ws.send(JSON.stringify({
        type: 'extension.pong',
        version: '0.1.0',
        timestamp: Date.now()
      }))
      break

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }))
      break

    case 'auth.refresh':
      // 处理认证刷新
      console.log(`[WsGateway] Auth refresh for provider: ${data.provider}`)
      // 这里可以调用认证服务
      ws.send(JSON.stringify({
        type: 'auth.refreshed',
        provider: data.provider,
        success: true,
        timestamp: Date.now()
      }))
      break

    case 'ai.tab.register':
      messageRouter.handleTabRegister(clientId, data)
      break

    case 'ai.tab.status':
      messageRouter.handleTabStatus(clientId, data)
      break

    case 'ai.prompt.execute':
      messageRouter.handlePromptExecute(clientId, data)
      break

    case 'ai.response.done': {
      // 1) 解析 ExtensionMessageService 的 pendingPrompts（原有的请求-响应模式）
      const payload = data.payload || { text: data.text }
      const text = payload.text ?? data.text ?? ''
      extensionMessageService.handleResponse(data.correlationId, {
        text,
        parsed: payload.parsed
      })
      // 2) 解析 WsMessageRouterService 的 pendingRequests
      messageRouter.handleResponseDone(clientId, data)
      // 3) 回流到决策服务（多轮讨论引擎）
      if (data.participantId) {
        decisionRequestService.handleParticipantResponse(
          data.correlationId,
          data.participantId,
          { text, parsed: payload.parsed }
        )
      }
      break
    }

    case 'ai.response.error': {
      extensionMessageService.handleError(data.correlationId, data.error?.message || data.error || 'Unknown error')
      messageRouter.handleResponseError(clientId, data)
      if (data.participantId) {
        decisionRequestService.handleParticipantError(
          data.correlationId,
          data.participantId,
          typeof data.error === 'string' ? data.error : (data.error?.message || 'Unknown error')
        )
      }
      break
    }

    case 'room.create':
      messageRouter.handleRoomCreate(clientId, data)
      break

    case 'room.join':
      messageRouter.handleRoomJoin(clientId, data)
      break

    case 'room.leave':
      messageRouter.handleRoomLeave(clientId, data)
      break

    default:
      console.log(`[WsGateway] Unknown message type: ${type}`)
  }
}

bootstrap()
