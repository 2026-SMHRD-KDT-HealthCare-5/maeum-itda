/*
역할: 질문별 음성 묶음의 임시 보관, FastAPI REST 호출, 분석 결과 DB 저장 순서를 관리한다.
전체 흐름: AudioBinaryHandler → AnalysisService → TemporaryAudioRepository/AiClient/AnalysisResultRepository
주의: STT·감성·척도·다음 질문 생성 자체는 FastAPI 책임이며 NestJS는 전달과 영속화만 담당한다.
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

@Injectable()
export class AnalysisService {
  constructor(
    private readonly aiClient: AiClient,
    private readonly temporaryAudioRepository: TemporaryAudioRepository,
    private readonly analysisResultRepository: AnalysisResultRepository,
  ) {}

  // 역할: 5초 추가 답변 대기가 끝난 묶음을 보관하고 모든 답변을 WAITING으로 표시한다.
  async enqueueAnswerBatch(batch: QuestionAnswerBatch): Promise<void> {
    this.temporaryAudioRepository.save(batch);
    await this.analysisResultRepository.markWaiting(
      batch.answers.map(({ messageId }) => messageId),
    );
  }

  isFastApiConnected(): boolean {
    return this.aiClient.isConnected();
  }

  // 역할: 질문별 음성 전체를 FastAPI에 한 번 요청하고 답변별 결과와 다음 질문을 저장한다.
  async processPendingAnswerBatch(
    questionMessageId: number,
  ): Promise<CompletedAudioAnalysis | null> {
    if (!this.aiClient.isConnected()) return null;

    const batch =
      this.temporaryAudioRepository.findByQuestionMessageId(questionMessageId);
    if (batch === undefined) {
      throw new NotFoundException(
        '임시 보관 중인 질문별 음성 묶음이 없습니다.',
      );
    }

    const messageIds = batch.answers.map(({ messageId }) => messageId);
    await this.analysisResultRepository.markProcessing(messageIds);
    try {
      const result = await this.aiClient.analyzeAnswerBatch(batch);
      const completed = await this.analysisResultRepository.saveCompleted(
        batch,
        randomUUID(),
        result,
      );
      this.temporaryAudioRepository.delete(questionMessageId);
      return completed;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : '음성 분석에 실패했습니다.';
      await this.analysisResultRepository.markFailed(messageIds, message);
      throw error;
    }
  }

  getStatus(messageId: number) {
    return this.analysisResultRepository.findStatus(messageId);
  }
}
