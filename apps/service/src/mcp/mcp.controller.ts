import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger'
import { McpToolsService, McpCallToolRequest, McpCallToolResponse } from './mcp-tools.service'

// DTO for Swagger documentation
export class McpCallToolRequestDto {
  name: string
  arguments?: Record<string, any>
}

/**
 * MCP (Model Context Protocol) HTTP 端点
 * 
 * MCP 是一种标准协议，允许 AI 模型与外部工具交互。
 * 此控制器实现了 MCP 协议的 HTTP 传输层。
 * 
 * 官方规范: https://modelcontextprotocol.io/
 */
@ApiTags('mcp')
@Controller('mcp')
export class McpController {
  constructor(private readonly mcpToolsService: McpToolsService) {}

  /**
   * 获取 MCP 服务器信息
   */
  @Get()
  @ApiOperation({ summary: '获取 MCP 服务器信息', description: '返回 MCP 服务器的名称、版本和能力信息' })
  @ApiResponse({ status: 200, description: '服务器信息' })
  getInfo() {
    return {
      name: 'AI Council MCP Server',
      version: '0.1.0',
      protocolVersion: this.mcpToolsService.protocolVersion,
      capabilities: {
        tools: {
          listChanged: true
        },
        resources: {
          subscribe: true,
          listChanged: true
        }
      }
    }
  }

  /**
   * 列出所有可用工具
   */
  @Get('tools')
  @ApiOperation({ summary: '列出所有可用工具', description: '返回所有可用的 MCP 工具列表' })
  @ApiResponse({ status: 200, description: '工具列表' })
  listTools() {
    const tools = this.mcpToolsService.getTools()
    return {
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }))
    }
  }

  /**
   * 调用工具
   */
  @Post('tools/call')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '调用 MCP 工具', description: '调用指定的 MCP 工具并返回结果' })
  @ApiBody({ type: McpCallToolRequestDto })
  @ApiResponse({ status: 200, description: '工具调用结果' })
  async callTool(@Body() request: McpCallToolRequestDto): Promise<McpCallToolResponse> {
    return this.mcpToolsService.callTool(request.name, request.arguments || {})
  }

  /**
   * 列出所有可用资源
   */
  @Get('resources')
  @ApiOperation({ summary: '列出所有可用资源', description: '返回所有可用的 MCP 资源列表' })
  @ApiResponse({ status: 200, description: '资源列表' })
  listResources() {
    const resources = this.mcpToolsService.getResources()
    return {
      resources: resources.map(resource => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType
      }))
    }
  }

  /**
   * 资源模板列表 (MCP 0.5+)
   */
  @Get('resources/templates')
  @ApiOperation({ summary: '列出资源模板', description: '返回可用的资源模板列表，支持动态 URI 替换' })
  @ApiResponse({ status: 200, description: '资源模板列表' })
  listResourceTemplates() {
    return {
      resourceTemplates: [
        {
          uriTemplate: 'ai-council://room/{roomId}',
          name: '房间详情',
          description: '获取指定房间的详细信息',
          mimeType: 'application/json'
        },
        {
          uriTemplate: 'ai-council://issue/{issueId}',
          name: '问题详情',
          description: '获取指定问题的详细信息',
          mimeType: 'application/json'
        },
        {
          uriTemplate: 'ai-council://participant/{participantId}',
          name: '参与者详情',
          description: '获取指定参与者的详细信息',
          mimeType: 'application/json'
        },
        {
          uriTemplate: 'ai-council://decision/{decisionId}',
          name: '决策详情',
          description: '获取指定决策的详细信息',
          mimeType: 'application/json'
        }
      ]
    }
  }
}
