/*
역할: 확정된 질문별 음성 답변 묶음을 FastAPI 처리 완료 전까지 서버 메모리에 임시 보관한다.
연결 객체: QuestionAnswerQueueService → AnalysisService → TemporaryAudioRepository → AiClient
주의: 프로세스 재시작 시 사라지는 MVP용 저장소이며 FastAPI 분석 기능을 포함하지 않는다.
*/
import { Injectable } from '@nestjs/common';
import { QuestionAnswerBatch } from '../dto/audio-analysis.contract';

@Injectable()
export class TemporaryAudioRepository {
  private readonly pendingByQuestionMessageId = new Map<
    number,
    QuestionAnswerBatch
  >();

  save(batch: QuestionAnswerBatch): void {
    this.pendingByQuestionMessageId.set(batch.questionMessageId, batch);
  }

  findByQuestionMessageId(
    questionMessageId: number,
  ): QuestionAnswerBatch | undefined {
    return this.pendingByQuestionMessageId.get(questionMessageId);
  }

  delete(questionMessageId: number): void {
    this.pendingByQuestionMessageId.delete(questionMessageId);
  }
}
