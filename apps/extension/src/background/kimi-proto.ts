/**
 * Kimi Protobuf 加载器
 * 使用 protobufjs 进行消息编解码
 * 纯浏览器兼容版本（无 Node.js 依赖）
 */

import * as protobuf from 'protobufjs'

// 缓存加载的 root
let protoRoot: protobuf.Root | null = null

// 缓存的服务和类型
let services: {
  ChatService: protobuf.Service
  UserService: protobuf.Service
} | null = null

let types: {
  ListChatsRequest: protobuf.Type
  ListChatsResponse: protobuf.Type
  GetChatRequest: protobuf.Type
  GetChatResponse: protobuf.Type
  CreateChatRequest: protobuf.Type
  CreateChatResponse: protobuf.Type
  UpdateChatRequest: protobuf.Type
  UpdateChatResponse: protobuf.Type
  DeleteChatRequest: protobuf.Type
  DeleteChatResponse: protobuf.Type
  ArchiveChatRequest: protobuf.Type
  ArchiveChatResponse: protobuf.Type
  ListMessagesRequest: protobuf.Type
  ListMessagesResponse: protobuf.Type
  CompletionRequest: protobuf.Type
  CompletionResponse: protobuf.Type
  CompletionChunk: protobuf.Type
  Message: protobuf.Type
  Chat: protobuf.Type
  Content: protobuf.Type
  Delta: protobuf.Type
  ChoiceDelta: protobuf.Type
  ListWorkspacesRequest: protobuf.Type
  ListWorkspacesResponse: protobuf.Type
  GetWorkspaceRequest: protobuf.Type
  GetWorkspaceResponse: protobuf.Type
  CreateWorkspaceRequest: protobuf.Type
  CreateWorkspaceResponse: protobuf.Type
  UpdateWorkspaceRequest: protobuf.Type
  UpdateWorkspaceResponse: protobuf.Type
  DeleteWorkspaceRequest: protobuf.Type
  DeleteWorkspaceResponse: protobuf.Type
  Workspace: protobuf.Type
  User: protobuf.Type
} | null = null

/**
 * 创建内联 proto 定义（浏览器兼容）
 */
function createInlineProto(): protobuf.Root {
  const root = new protobuf.Root()

  // 定义所有类型
  const definitions: protobuf.Type[] = [
    // Content
    new protobuf.Type('Content')
      .add(new protobuf.Field('text', 1, 'string')),
    
    // Message
    new protobuf.Type('Message')
      .add(new protobuf.Field('role', 1, 'string'))
      .add(new protobuf.Field('content', 2, 'Content')),
    
    // Chat
    new protobuf.Type('Chat')
      .add(new protobuf.Field('id', 1, 'string'))
      .add(new protobuf.Field('name', 2, 'string'))
      .add(new protobuf.Field('created_at', 3, 'int64'))
      .add(new protobuf.Field('updated_at', 4, 'int64'))
      .add(new protobuf.Field('model', 5, 'string'))
      .add(new protobuf.Field('workspace_id', 6, 'string'))
      .add(new protobuf.Field('is_archived', 7, 'bool'))
      .add(new protobuf.Field('is_starred', 8, 'bool'))
      .add(new protobuf.Field('last_message', 9, 'Message')),
    
    // ListChatsRequest
    new protobuf.Type('ListChatsRequest')
      .add(new protobuf.Field('offset', 1, 'int32'))
      .add(new protobuf.Field('limit', 2, 'int32'))
      .add(new protobuf.Field('workspace_id', 3, 'string'))
      .add(new protobuf.Field('is_archived', 4, 'bool')),
    
    // ListChatsResponse
    new protobuf.Type('ListChatsResponse')
      .add(new protobuf.Field('chats', 1, 'Chat', 'repeated'))
      .add(new protobuf.Field('total', 2, 'int32'))
      .add(new protobuf.Field('has_more', 3, 'bool')),
    
    // GetChatRequest
    new protobuf.Type('GetChatRequest')
      .add(new protobuf.Field('chat_id', 1, 'string')),
    
    // GetChatResponse
    new protobuf.Type('GetChatResponse')
      .add(new protobuf.Field('chat', 1, 'Chat')),
    
    // CreateChatRequest
    new protobuf.Type('CreateChatRequest')
      .add(new protobuf.Field('name', 1, 'string'))
      .add(new protobuf.Field('workspace_id', 2, 'string'))
      .add(new protobuf.Field('model', 3, 'string')),
    
    // CreateChatResponse
    new protobuf.Type('CreateChatResponse')
      .add(new protobuf.Field('chat', 1, 'Chat')),
    
    // UpdateChatRequest
    new protobuf.Type('UpdateChatRequest')
      .add(new protobuf.Field('chat_id', 1, 'string'))
      .add(new protobuf.Field('name', 2, 'string'))
      .add(new protobuf.Field('is_starred', 3, 'bool'))
      .add(new protobuf.Field('is_archived', 4, 'bool')),
    
    // UpdateChatResponse
    new protobuf.Type('UpdateChatResponse')
      .add(new protobuf.Field('chat', 1, 'Chat')),
    
    // DeleteChatRequest
    new protobuf.Type('DeleteChatRequest')
      .add(new protobuf.Field('chat_id', 1, 'string')),
    
    // DeleteChatResponse
    new protobuf.Type('DeleteChatResponse')
      .add(new protobuf.Field('success', 1, 'bool')),
    
    // ArchiveChatRequest
    new protobuf.Type('ArchiveChatRequest')
      .add(new protobuf.Field('chat_id', 1, 'string')),
    
    // ArchiveChatResponse
    new protobuf.Type('ArchiveChatResponse')
      .add(new protobuf.Field('chat', 1, 'Chat')),
    
    // ListMessagesRequest
    new protobuf.Type('ListMessagesRequest')
      .add(new protobuf.Field('chat_id', 1, 'string'))
      .add(new protobuf.Field('offset', 2, 'int32'))
      .add(new protobuf.Field('limit', 3, 'int32'))
      .add(new protobuf.Field('parent_id', 4, 'string')),
    
    // ListMessagesResponse
    new protobuf.Type('ListMessagesResponse')
      .add(new protobuf.Field('messages', 1, 'Message', 'repeated'))
      .add(new protobuf.Field('total', 2, 'int32'))
      .add(new protobuf.Field('has_more', 3, 'bool')),
    
    // Completion 相关
    new protobuf.Type('CompletionRequest')
      .add(new protobuf.Field('model', 1, 'string'))
      .add(new protobuf.Field('messages', 2, 'Message', 'repeated'))
      .add(new protobuf.Field('conversation_id', 3, 'string'))
      .add(new protobuf.Field('parent_id', 4, 'string'))
      .add(new protobuf.Field('stream', 5, 'bool')),
    
    new protobuf.Type('Usage')
      .add(new protobuf.Field('prompt_tokens', 1, 'int32'))
      .add(new protobuf.Field('completion_tokens', 2, 'int32'))
      .add(new protobuf.Field('total_tokens', 3, 'int32')),
    
    new protobuf.Type('Choice')
      .add(new protobuf.Field('index', 1, 'int32'))
      .add(new protobuf.Field('message', 2, 'Message'))
      .add(new protobuf.Field('finish_reason', 3, 'string')),
    
    new protobuf.Type('Delta')
      .add(new protobuf.Field('role', 1, 'string'))
      .add(new protobuf.Field('content', 2, 'string')),
    
    new protobuf.Type('ChoiceDelta')
      .add(new protobuf.Field('index', 1, 'int32'))
      .add(new protobuf.Field('delta', 2, 'Delta'))
      .add(new protobuf.Field('finish_reason', 3, 'string')),
    
    new protobuf.Type('CompletionResponse')
      .add(new protobuf.Field('id', 1, 'string'))
      .add(new protobuf.Field('model', 2, 'string'))
      .add(new protobuf.Field('choices', 3, 'Choice', 'repeated'))
      .add(new protobuf.Field('usage', 4, 'Usage')),
    
    new protobuf.Type('CompletionChunk')
      .add(new protobuf.Field('id', 1, 'string'))
      .add(new protobuf.Field('model', 2, 'string'))
      .add(new protobuf.Field('choices', 3, 'ChoiceDelta', 'repeated')),
    
    // Workspace 相关
    new protobuf.Type('User')
      .add(new protobuf.Field('id', 1, 'string'))
      .add(new protobuf.Field('name', 2, 'string'))
      .add(new protobuf.Field('avatar', 3, 'string')),
    
    new protobuf.Type('Workspace')
      .add(new protobuf.Field('id', 1, 'string'))
      .add(new protobuf.Field('name', 2, 'string'))
      .add(new protobuf.Field('description', 3, 'string'))
      .add(new protobuf.Field('created_at', 4, 'int64'))
      .add(new protobuf.Field('updated_at', 5, 'int64'))
      .add(new protobuf.Field('is_default', 6, 'bool'))
      .add(new protobuf.Field('member_count', 7, 'int32'))
      .add(new protobuf.Field('owner', 8, 'User')),
    
    new protobuf.Type('ListWorkspacesRequest')
      .add(new protobuf.Field('offset', 1, 'int32'))
      .add(new protobuf.Field('limit', 2, 'int32')),
    
    new protobuf.Type('ListWorkspacesResponse')
      .add(new protobuf.Field('workspaces', 1, 'Workspace', 'repeated'))
      .add(new protobuf.Field('total', 2, 'int32')),
    
    new protobuf.Type('GetWorkspaceRequest')
      .add(new protobuf.Field('workspace_id', 1, 'string')),
    
    new protobuf.Type('GetWorkspaceResponse')
      .add(new protobuf.Field('workspace', 1, 'Workspace')),
    
    new protobuf.Type('CreateWorkspaceRequest')
      .add(new protobuf.Field('name', 1, 'string'))
      .add(new protobuf.Field('description', 2, 'string')),
    
    new protobuf.Type('CreateWorkspaceResponse')
      .add(new protobuf.Field('workspace', 1, 'Workspace')),
    
    new protobuf.Type('UpdateWorkspaceRequest')
      .add(new protobuf.Field('workspace_id', 1, 'string'))
      .add(new protobuf.Field('name', 2, 'string'))
      .add(new protobuf.Field('description', 3, 'string')),
    
    new protobuf.Type('UpdateWorkspaceResponse')
      .add(new protobuf.Field('workspace', 1, 'Workspace')),
    
    new protobuf.Type('DeleteWorkspaceRequest')
      .add(new protobuf.Field('workspace_id', 1, 'string')),
    
    new protobuf.Type('DeleteWorkspaceResponse')
      .add(new protobuf.Field('success', 1, 'bool')),
  ]

  // 添加到 root
  for (const def of definitions) {
    root.add(def)
  }

  return root
}

/**
 * 加载并解析 proto 定义
 */
export async function loadProto(): Promise<protobuf.Root> {
  if (protoRoot) {
    return protoRoot
  }

  // 使用内联定义（浏览器兼容）
  protoRoot = createInlineProto()
  return protoRoot
}

/**
 * 获取服务定义
 */
export async function getServices() {
  if (services) return services

  const root = await loadProto()
  services = {
    ChatService: root.lookupService('kimi.ChatService'),
    UserService: root.lookupService('kimi.UserService')
  }
  return services
}

/**
 * 获取类型定义
 */
export async function getTypes() {
  if (types) return types

  const root = await loadProto()
  types = {
    ListChatsRequest: root.lookupType('kimi.ListChatsRequest'),
    ListChatsResponse: root.lookupType('kimi.ListChatsResponse'),
    GetChatRequest: root.lookupType('kimi.GetChatRequest'),
    GetChatResponse: root.lookupType('kimi.GetChatResponse'),
    CreateChatRequest: root.lookupType('kimi.CreateChatRequest'),
    CreateChatResponse: root.lookupType('kimi.CreateChatResponse'),
    UpdateChatRequest: root.lookupType('kimi.UpdateChatRequest'),
    UpdateChatResponse: root.lookupType('kimi.UpdateChatResponse'),
    DeleteChatRequest: root.lookupType('kimi.DeleteChatRequest'),
    DeleteChatResponse: root.lookupType('kimi.DeleteChatResponse'),
    ArchiveChatRequest: root.lookupType('kimi.ArchiveChatRequest'),
    ArchiveChatResponse: root.lookupType('kimi.ArchiveChatResponse'),
    ListMessagesRequest: root.lookupType('kimi.ListMessagesRequest'),
    ListMessagesResponse: root.lookupType('kimi.ListMessagesResponse'),
    CompletionRequest: root.lookupType('kimi.CompletionRequest'),
    CompletionResponse: root.lookupType('kimi.CompletionResponse'),
    CompletionChunk: root.lookupType('kimi.CompletionChunk'),
    Message: root.lookupType('kimi.Message'),
    Chat: root.lookupType('kimi.Chat'),
    Content: root.lookupType('kimi.Content'),
    Delta: root.lookupType('kimi.Delta'),
    ChoiceDelta: root.lookupType('kimi.ChoiceDelta'),
    ListWorkspacesRequest: root.lookupType('kimi.ListWorkspacesRequest'),
    ListWorkspacesResponse: root.lookupType('kimi.ListWorkspacesResponse'),
    GetWorkspaceRequest: root.lookupType('kimi.GetWorkspaceRequest'),
    GetWorkspaceResponse: root.lookupType('kimi.GetWorkspaceResponse'),
    CreateWorkspaceRequest: root.lookupType('kimi.CreateWorkspaceRequest'),
    CreateWorkspaceResponse: root.lookupType('kimi.CreateWorkspaceResponse'),
    UpdateWorkspaceRequest: root.lookupType('kimi.UpdateWorkspaceRequest'),
    UpdateWorkspaceResponse: root.lookupType('kimi.UpdateWorkspaceResponse'),
    DeleteWorkspaceRequest: root.lookupType('kimi.DeleteWorkspaceRequest'),
    DeleteWorkspaceResponse: root.lookupType('kimi.DeleteWorkspaceResponse'),
    Workspace: root.lookupType('kimi.Workspace'),
    User: root.lookupType('kimi.User'),
  }
  return types
}

/**
 * 编码消息为 protobuf
 */
export function encode(type: protobuf.Type, data: object): Uint8Array {
  const message = type.create(data)
  return type.encode(message).finish()
}

/**
 * 解码 protobuf 消息
 */
export function decode<T extends protobuf.Message<T>>(type: protobuf.Type, buffer: Uint8Array): T {
  return type.decode(buffer) as T
}

/**
 * 解码为 JSON
 */
export function toJSON(type: protobuf.Type, buffer: Uint8Array): object {
  const decoded = decode(type, buffer)
  return type.toObject(decoded, {
    longs: Number,
    enums: String,
    defaults: true
  })
}
