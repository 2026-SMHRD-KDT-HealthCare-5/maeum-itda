/*
역할: 같은 AI 질문에 대한 여러 녹음 답변을 10초의 추가 답변 대기 시간 동안 메모리에 모은다.
연결 객체: AudioBinaryHandler → QuestionAnswerQueueService → AnalysisService
전체 흐름: 첫 음성 등록 → 추가 음성마다 타이머 갱신 → 10초 동안 추가 음성이 없으면 질문별 묶음 반환
[완료] 30초 생각 시간과 발화 후 10초 무음 감지는 프론트 녹음 영역이며, 이 서비스는 수신 완료된 음성 사이의 10초 결합만 담당한다.
[2026-08-19 수정] 방금 등록된 음성의 endType이 'manual'(시니어가 "지금 답변 마치기"를
직접 눌러 종료)이면 10초를 기다리지 않고 즉시 확정한다 — 사용자가 이미 "다 말했다"고
명시적으로 알려준 상태라 추가 답변을 기다릴 이유가 없고, 실측해보니 이 무조건 10초
대기가 전체 턴 지연의 대부분(약 15초 중 11초)을 차지하고 있었다. endType이
'auto'(묵음 감지로 자동 종료)일 때만 기존처럼 10초를 기다린다 — 이 경우는 정말
말을 끝낸 건지 잠깐 멈춘 건지 알 수 없기 때문이다.
[제약] 질문 Queue와 음성 Buffer는 프로세스 메모리에 있어 재시작 시 소실되고 여러 서버가 공유하지 못하며 동시 사용자 수에 따라 메모리 사용량이 증가한다.
*/
import { Injectable } from '@nestjs/common';
import {
  QuestionAnswerBatch,
  QueuedAnswerSegment,
} from '../analysis/dto/audio-analysis.contract';

// 시니어가 녹음을 마친 뒤 같은 질문에 덧붙일 말을 떠올릴 시간을 보장한다.
export const ADDITIONAL_ANSWER_WAIT_MS = 10_000;
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
  timer: NodeJS.Timeout;
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

  // 역할: 음성 한 건을 질문별 큐에 추가하고 추가 답변 대기 타이머를 시작하거나 갱신한다.
  // endType이 'manual'이면(사용자가 "지금 답변 마치기"로 직접 종료) 10초를 기다리지
  // 않고 즉시 확정한다 — 이미 다 말했다고 명시적으로 알려준 상태이기 때문이다.
  enqueue(answer: QueuedAnswerSegment): EnqueuedQuestionAnswers {
    this.assertCanAccept(
      answer.questionMessageId,
      answer.audioBuffer.byteLength,
    );
    const existing = this.pendingByQuestionMessageId.get(
      answer.questionMessageId,
    );
    if (existing !== undefined) {
      this.assertSameQuestionContext(existing.batch, answer);
      existing.batch.answers.push(answer);
      clearTimeout(existing.timer);
      existing.timer = this.createFlushTimer(answer.questionMessageId);
      if (answer.endType === 'manual') this.flush(answer.questionMessageId);
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
      timer: this.createFlushTimer(answer.questionMessageId),
    });
    if (answer.endType === 'manual') this.flush(answer.questionMessageId);
    return { isBatchOwner: true, ready };
  }

  // 역할: DB 저장 전에 질문별 답변 개수와 전체 Buffer 용량 제한을 검사한다.
  assertCanAccept(questionMessageId: number, audioBytes: number): void {
    const pending = this.pendingByQuestionMessageId.get(questionMessageId);
    if (pending === undefined) return;

    if (pending.batch.answers.length >= MAX_ANSWER_SEGMENTS_PER_QUESTION) {
      throw new QuestionAnswerQueueLimitError(
        'ANSWER_SEGMENT_LIMIT_EXCEEDED',
        '한 질문에는 음성 답변을 최대 5개까지 추가할 수 있습니다.',
      );
    }

    const currentBytes = pending.batch.answers.reduce(
      (total, answer) => total + answer.audioBuffer.byteLength,
      0,
    );
    if (currentBytes + audioBytes > MAX_ANSWER_AUDIO_BYTES_PER_QUESTION) {
      throw new QuestionAnswerQueueLimitError(
        'ANSWER_AUDIO_SIZE_LIMIT_EXCEEDED',
        '한 질문의 전체 음성 데이터는 30MB를 초과할 수 없습니다.',
      );
    }
  }

  // 역할: 연결 종료 등에서 아직 확정되지 않은 질문별 큐를 즉시 분석 가능한 묶음으로 확정한다.
  flush(questionMessageId: number, continueConversation = true): void {
    const pending = this.pendingByQuestionMessageId.get(questionMessageId);
    if (pending === undefined) return;
    pending.batch.continueConversation = continueConversation;
    clearTimeout(pending.timer);
    this.pendingByQuestionMessageId.delete(questionMessageId);
    pending.resolve(pending.batch);
  }

  private createFlushTimer(questionMessageId: number): NodeJS.Timeout {
    return setTimeout(
      () => this.flush(questionMessageId),
      ADDITIONAL_ANSWER_WAIT_MS,
    );
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
