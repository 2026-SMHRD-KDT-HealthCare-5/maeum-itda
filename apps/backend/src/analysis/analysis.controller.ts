/*
역할: 음성 분석 상태 조회와 FastAPI 연결 후 수동 재시도 REST API를 제공한다.
주의: 음성 업로드는 중복 구현하지 않고 기존 WebSocket AudioBinaryHandler가 담당한다.
*/
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../common/dto/api-error-response.dto';
import { AnalysisService } from './analysis.service';
import {
  RetryAudioAnalysisResponseDto,
  VoiceAnalysisStatusResponseDto,
} from './dto/analysis-response.dto';

@ApiTags('3. 음성 분석')
@Controller('analysis/audio')
export class AnalysisController {
  // 연결 객체: 음성 분석 상태 조회와 재시도 업무를 담당하는 AnalysisService
  constructor(private readonly analysisService: AnalysisService) {}

  // 역할: 메시지 ID에 연결된 VOICE_ANALYSIS_STATUS를 조회한다.
  // 다음 호출: AnalysisService.getStatus() → AnalysisResultRepository → MySQL
  @Get(':messageId/status')
  @ApiOperation({ summary: '메시지의 음성 분석 상태 조회' })
  @ApiParam({
    name: 'messageId',
    type: Number,
    description: '분석 대상 메시지 ID',
  })
  @ApiOkResponse({
    description: '음성 분석 상태 반환',
    type: VoiceAnalysisStatusResponseDto,
  })
  @ApiNotFoundResponse({
    description: '해당 메시지의 음성 분석 상태가 없음',
    type: ApiErrorResponseDto,
  })
  async getStatus(@Param('messageId', ParseIntPipe) messageId: number) {
    const status = await this.analysisService.getStatus(messageId);
    if (status === null) {
      throw new NotFoundException('음성 분석 상태를 찾을 수 없습니다.');
    }
    return status;
  }

  // 역할: 질문 ID로 메모리에 남은 복수 음성 묶음을 FastAPI에 다시 전달한다.
  // 다음 호출: AnalysisService.processPendingAnswerBatch() → AiClient → FastAPI
  @Post('question/:questionMessageId/retry')
  @ApiOperation({ summary: '메모리에 대기 중인 질문별 음성 분석 재시도' })
  @ApiParam({
    name: 'questionMessageId',
    type: Number,
    description: '다시 분석할 AI 질문 메시지 ID',
  })
  @ApiOkResponse({
    description:
      '분석 완료 결과. FastAPI가 연결되지 않으면 null을 반환할 수 있다.',
    type: RetryAudioAnalysisResponseDto,
  })
  @ApiNotFoundResponse({
    description: '메모리에 대기 중인 음성 묶음이 없음',
    type: ApiErrorResponseDto,
  })
  retry(@Param('questionMessageId', ParseIntPipe) questionMessageId: number) {
    return this.analysisService.processPendingAnswerBatch(questionMessageId);
  }
}
