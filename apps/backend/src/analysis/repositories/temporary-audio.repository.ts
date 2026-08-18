/*
역할: 확정된 질문별 음성 답변 묶음을 FastAPI 처리 완료 전까지 서버 메모리에 임시 보관한다.
연결 객체: QuestionAnswerQueueService → AnalysisService → TemporaryAudioRepository → AiClient
[완료] FastAPI 처리 전 질문별 음성 묶음을 보관하고 완료 후 제거한다.
[제약] 서버 재시작 시 소실되고 여러 인스턴스가 공유하지 못하며, 다른 서버로 재접속하면 복원할 수 없고 동시 음성 크기만큼 메모리를 사용한다.
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
