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
import { AnalysisService } from './analysis.service';

@Controller('analysis/audio')
export class AnalysisController {
  // 연결 객체: 음성 분석 상태 조회와 재시도 업무를 담당하는 AnalysisService
  constructor(private readonly analysisService: AnalysisService) {}

  // 역할: 메시지 ID에 연결된 VOICE_ANALYSIS_STATUS를 조회한다.
  // 다음 호출: AnalysisService.getStatus() → AnalysisResultRepository → MySQL
  @Get(':messageId/status')
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
  retry(@Param('questionMessageId', ParseIntPipe) questionMessageId: number) {
    return this.analysisService.processPendingAnswerBatch(questionMessageId);
  }
}
