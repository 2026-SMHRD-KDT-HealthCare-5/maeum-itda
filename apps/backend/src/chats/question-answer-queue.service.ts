/*
역할: 같은 AI 질문에 대한 녹음 답변을 큐에 등록하고 질문별 묶음으로 반환한다.
연결 객체: AudioBinaryHandler → QuestionAnswerQueueService → AnalysisService
전체 흐름: 음성 등록 → 즉시 확정(더 기다리지 않음) → 질문별 묶음 반환
[완료] 30초 생각 시간과 발화 후 3초 무음 감지는 프론트 녹음 영역이며, 이 서비스는 수신 완료된 음성의 큐 등록만 담당한다.
[2026-08-21 수정] 예전에는 endType이 'auto'(묵음 감지로 자동 종료)일 때 후속 발화가
있는지 보려고 추가로 3초를 더 기다렸다(ADDITIONAL_ANSWER_WAIT_MS) — 프론트가 이미
3초 무음을 확인한 뒤에만 auto가 발생하므로(AUTO_SILENCE_MS, useRecordVoiceAnswer),
여기서 또 기다리는 건 화면 표시까지의 지연을 그대로 늘리는 중복 대기였다. 이제
'manual'과 동일하게 도착 즉시 확정한다 — 후속 발화가 짧은 간격으로 이어지면 같은
질문에 병합되지 않고 별도의 늦은 답변(§ AudioBinaryHandler의 "늦은 답변" 경로)으로
처리된다.
[제약] 질문 Queue와 음성 Buffer는 프로세스 메모리에 있어 재시작 시 소실되고 여러 서버가 공유하지 못하며 동시 사용자 수에 따라 메모리 사용량이 증가한다.
*/
import { Injectable } from '@nestjs/common';
import {
  QuestionAnswerBatch,
  QueuedAnswerSegment,
} from '../analysis/dto/audio-analysis.contract';

export const MAX_ANSWER_SEGMENTS_PER_QUESTION = 5;
export const MAX_ANSWER_AUDIO_BYTES_PER_QUESTION = 30 * 1024 * 1024;

export class QuestionAnswerQueueLimitError extends Error {
  constructor(
    readonly code:
      'ANSWER_SEGMENT_LIMIT_EXCEEDED' | 'ANSWER_AUDIO_SIZE_LIMIT_EXCEEDED',
    message: string,
  ) {
    super(message);
  }
}

interface PendingQuestionAnswers {
  batch: QuestionAnswerBatch;
  ready: Promise<QuestionAnswerBatch>;
  resolve: (batch: QuestionAnswerBatch) => void;
}

export interface EnqueuedQuestionAnswers {
  // true인 호출자만 ready 완료 후 분석을 시작하여 중복 FastAPI 요청을 방지한다.
  isBatchOwner: boolean;
  ready: Promise<QuestionAnswerBatch>;
}

@Injectable()
export class QuestionAnswerQueueService {
  private readonly pendingByQuestionMessageId = new Map<
    number,
    PendingQuestionAnswers
  >();
  // enqueue()가 매번 즉시 flush하므로 pendingByQuestionMessageId에는 개수·용량이
  // 누적되지 않는다 — 그래서 질문별 총 답변 개수·용량 제한은 별도로 계속 누적해서
  // 추적한다(질문마다 한 번 생기는 questionMessageId 기준이라 무한정 쌓이지는 않음).
  private readonly answerCountByQuestionMessageId = new Map<number, number>();
  private readonly answerBytesByQuestionMessageId = new Map<number, number>();

  // 역할: 음성 한 건을 질문별 큐에 추가하고 도착 즉시(endType 무관) 확정한다.
  enqueue(answer: QueuedAnswerSegment): EnqueuedQuestionAnswers {
    this.assertCanAccept(
      answer.questionMessageId,
      answer.audioBuffer.byteLength,
    );
    this.answerCountByQuestionMessageId.set(
      answer.questionMessageId,
      (this.answerCountByQuestionMessageId.get(answer.questionMessageId) ?? 0) +
        1,
    );
    this.answerBytesByQuestionMessageId.set(
      answer.questionMessageId,
      (this.answerBytesByQuestionMessageId.get(answer.questionMessageId) ?? 0) +
        answer.audioBuffer.byteLength,
    );

    const existing = this.pendingByQuestionMessageId.get(
      answer.questionMessageId,
    );
    if (existing !== undefined) {
      this.assertSameQuestionContext(existing.batch, answer);
      existing.batch.answers.push(answer);
      this.flush(answer.questionMessageId);
      return { isBatchOwner: false, ready: existing.ready };
    }

    let resolve!: (batch: QuestionAnswerBatch) => void;
    const ready = new Promise<QuestionAnswerBatch>((resolvePromise) => {
      resolve = resolvePromise;
    });
    const batch: QuestionAnswerBatch = {
      questionMessageId: answer.questionMessageId,
      seniorId: answer.seniorId,
      generationId: answer.generationId,
      continueConversation: answer.continueConversation,
      answers: [answer],
    };
    this.pendingByQuestionMessageId.set(answer.questionMessageId, {
      batch,
      ready,
      resolve,
    });
    this.flush(answer.questionMessageId);
    return { isBatchOwner: true, ready };
  }

  // 역할: DB 저장 전에 질문별 누적 답변 개수와 총 Buffer 용량 제한을 검사한다.
  assertCanAccept(questionMessageId: number, audioBytes: number): void {
    const count =
      this.answerCountByQuestionMessageId.get(questionMessageId) ?? 0;
    if (count >= MAX_ANSWER_SEGMENTS_PER_QUESTION) {
      throw new QuestionAnswerQueueLimitError(
        'ANSWER_SEGMENT_LIMIT_EXCEEDED',
        '한 질문에는 음성 답변을 최대 5개까지 추가할 수 있습니다.',
      );
    }

    const currentBytes =
      this.answerBytesByQuestionMessageId.get(questionMessageId) ?? 0;
    if (currentBytes + audioBytes > MAX_ANSWER_AUDIO_BYTES_PER_QUESTION) {
      throw new QuestionAnswerQueueLimitError(
        'ANSWER_AUDIO_SIZE_LIMIT_EXCEEDED',
        '한 질문의 전체 음성 데이터는 30MB를 초과할 수 없습니다.',
      );
    }
  }

  // 역할: 질문별 큐를 즉시 분석 가능한 묶음으로 확정한다(enqueue()가 매번 호출, 대화
  // 종료 시 ChatEndHandler도 명시적으로 호출).
  flush(questionMessageId: number, continueConversation = true): void {
    const pending = this.pendingByQuestionMessageId.get(questionMessageId);
    if (pending === undefined) return;
    pending.batch.continueConversation = continueConversation;
    this.pendingByQuestionMessageId.delete(questionMessageId);
    pending.resolve(pending.batch);
  }

  private assertSameQuestionContext(
    batch: QuestionAnswerBatch,
    answer: QueuedAnswerSegment,
  ): void {
    if (
      batch.seniorId !== answer.seniorId ||
      batch.generationId !== answer.generationId
    ) {
      throw new Error(
        '같은 질문 큐에 서로 다른 대화 정보가 포함될 수 없습니다.',
      );
    }
  }
}
