/*
역할: 질문별 음성 묶음의 임시 보관, FastAPI REST 호출, 분석 결과 DB 저장 순서를 관리한다.
전체 흐름: AudioBinaryHandler → AnalysisService → TemporaryAudioRepository/AiClient/AnalysisResultRepository
[완료] STT·감성·척도·다음 질문 생성 자체는 FastAPI 책임이며 NestJS는 전달과 영속화만 담당한다.
[연동 대기] 실제 FastAPI 가용성은 분석 요청 결과로 확인하며 현재 메서드는 URL 설정 여부만 판단한다.
*/
import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AiClient } from './ai.client';
import {
  CompletedAudioAnalysis,
  QuestionAnswerBatch,
} from './dto/audio-analysis.contract';
import { AnalysisResultRepository } from './repositories/analysis-result.repository';
import { TemporaryAudioRepository } from './repositories/temporary-audio.repository';
import { AnalysisContextRepository } from './repositories/analysis-context.repository';

@Injectable()
export class AnalysisService {
  constructor(
    private readonly aiClient: AiClient,
    private readonly temporaryAudioRepository: TemporaryAudioRepository,
    private readonly analysisResultRepository: AnalysisResultRepository,
    private readonly analysisContextRepository: AnalysisContextRepository,
  ) {}

  // 역할: 10초 추가 답변 대기가 끝난 묶음을 FastAPI 처리 전까지 메모리에 보관한다.
  // 답변 메시지는 분석 성공 전까지 DB에 저장되지 않는다(결정사항: 분석 실패 시
  // CONVERSATION_MESSAGE·VOICE_ANALYSIS_STATUS에 흔적을 남기지 않는다).
  enqueueAnswerBatch(batch: QuestionAnswerBatch): void {
    this.temporaryAudioRepository.save(batch);
  }

  isFastApiConfigured(): boolean {
    return this.aiClient.isConfigured();
  }

  // 역할: 질문별 음성 전체를 FastAPI에 한 번 요청하고 답변별 결과와 다음 질문을 저장한다.
  // 실패하면(FastAPI 오류·검증 실패 등) 아무것도 저장하지 않고 그대로 throw하며,
  // temporaryAudioRepository에서도 지우지 않아 REST 재시도(POST .../retry) 대상으로 남는다.
  // [주의] isStillCurrent는 FastAPI 왕복(수 초)이 끝난 뒤 DB 저장 직전에 다시 평가한다 —
  // enqueue 시점의 continueConversation만 믿으면, 그 사이에 시니어가 대화를 종료했거나
  // 더 빠른 다른 배치가 이미 다음 질문을 만든 경우에도 답변되지 않은 "유령" 다음 질문이
  // 그대로 저장돼버린다(다음 chat:start의 DB 기준 재개 로직이 그걸 실제 진행 중인
  // 질문으로 오인해 되살릴 수 있다).
  async processPendingAnswerBatch(
    questionMessageId: number,
    isStillCurrent: () => boolean,
  ): Promise<CompletedAudioAnalysis | null> {
    if (!this.aiClient.isConfigured()) return null;

    const batch =
      this.temporaryAudioRepository.findByQuestionMessageId(questionMessageId);
    if (batch === undefined) {
      throw new NotFoundException(
        '임시 보관 중인 질문별 음성 묶음이 없습니다.',
      );
    }

    const context = await this.analysisContextRepository.findForBatch(batch);
    const requestBatch = { ...batch, ...context };
    const result = await this.aiClient.analyzeAnswerBatch(requestBatch);
    const completed = await this.analysisResultRepository.saveCompleted(
      {
        ...requestBatch,
        continueConversation:
          requestBatch.continueConversation && isStillCurrent(),
      },
      randomUUID(),
      result,
    );
    this.temporaryAudioRepository.delete(questionMessageId);
    return completed;
  }

  getStatus(messageId: number) {
    return this.analysisResultRepository.findStatus(messageId);
  }
}
