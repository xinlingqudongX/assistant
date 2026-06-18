import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { ZodValidationPipe } from 'nestjs-zod'
import { DecisionRequestService } from './decision-request.service'
import {
  DecisionRequestDto,
  DecisionRequestResponseDto,
  DecisionStatusDto,
  DecisionResultDto
} from './dto/decision.dto'

@ApiTags('decision')
@Controller('api/decision')
export class DecisionApiController {
  constructor(private readonly decisionService: DecisionRequestService) {}

  /**
   * 提交决策请求
   * 向房间中的 AI 参与者发起决策请求，收集各方意见并汇总
   */
  @Post('request')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '提交决策请求',
    description: '向 AI 参与者发起决策请求，系统会收集各方的决策意见并汇总返回（使用默认房间）'
  })
  @ApiResponse({
    status: 201,
    description: '决策请求已创建',
    type: DecisionRequestResponseDto
  })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  async submitDecision(
    @Body(new ZodValidationPipe()) request: DecisionRequestDto
  ): Promise<DecisionRequestResponseDto> {
    try {
      const result = await this.decisionService.submitDecisionRequest({
        task: request.task,
        context: request.context,
        options: request.options
      })

      return {
        decisionId: result.decisionId,
        status: result.status,
        createdAt: result.createdAt
      }
    } catch (error) {
      throw new BadRequestException(String(error))
    }
  }

  /**
   * 获取决策状态
   */
  @Get(':id/status')
  @ApiOperation({
    summary: '获取决策状态',
    description: '查询指定决策请求的当前状态，包括参与人数和已收到响应数'
  })
  @ApiResponse({
    status: 200,
    description: '决策状态',
    type: DecisionStatusDto
  })
  @ApiResponse({ status: 404, description: '决策不存在' })
  getDecisionStatus(@Param('id') id: string): DecisionStatusDto {
    const status = this.decisionService.getDecisionStatus(id)
    if (!status) {
      throw new NotFoundException(`Decision not found: ${id}`)
    }
    return status
  }

  /**
   * 获取决策结果
   */
  @Get(':id')
  @ApiOperation({
    summary: '获取决策结果',
    description: '获取决策请求的完整结果，包括各方意见和汇总建议'
  })
  @ApiResponse({
    status: 200,
    description: '决策结果',
    type: DecisionResultDto
  })
  @ApiResponse({ status: 404, description: '决策不存在' })
  getDecisionResult(@Param('id') id: string): DecisionResultDto {
    const result = this.decisionService.getDecisionResult(id)
    if (!result) {
      throw new NotFoundException(`Decision not found: ${id}`)
    }
    return result
  }

  /**
   * 列出所有决策
   */
  @Get()
  @ApiOperation({
    summary: '列出所有决策',
    description: '获取所有决策请求的列表'
  })
  @ApiResponse({
    status: 200,
    description: '决策列表'
  })
  listDecisions(): DecisionRequestResponseDto[] {
    const decisions = this.decisionService.listDecisions()
    return decisions.map(d => ({
      decisionId: d.decisionId,
      status: d.status,
      createdAt: d.createdAt
    }))
  }
}
