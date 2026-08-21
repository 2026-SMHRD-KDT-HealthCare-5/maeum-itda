import {
  MAX_ANSWER_AUDIO_BYTES_PER_QUESTION,
  MAX_ANSWER_SEGMENTS_PER_QUESTION,
  QuestionAnswerQueueLimitError,
  QuestionAnswerQueueService,
} from './question-answer-queue.service';
import type { QueuedAnswerSegment } from '../analysis/dto/audio-analysis.contract';

describe('QuestionAnswerQueueService', () => {
  let service: QuestionAnswerQueueService;

  beforeEach(() => {
    service = new QuestionAnswerQueueService();
  });

  const answer = (tempAnswerId: number): QueuedAnswerSegment => ({
    tempAnswerId,
    seniorId: 7,
    questionMessageId: 101,
    generationId: 'generation-001',
    audioTransferId: `audio-${tempAnswerId}`,
    mimeType: 'audio/webm',
    capturedAt: '2026-08-11T00:00:00.000Z',
    endType: 'auto',
    audioBuffer: Buffer.from([tempAnswerId]),
    continueConversation: true,
  });

  it('답변이 도착하면 endType과 무관하게 대기 없이 즉시 확정한다', async () => {
    const queued = service.enqueue(answer(102));
    expect(queued.isBatchOwner).toBe(true);

    await expect(queued.ready).resolves.toEqual(
      expect.objectContaining({
        questionMessageId: 101,
        answers: [answer(102)],
      }),
    );
  });

  it('endType이 manual이어도 동일하게 즉시 확정한다', async () => {
    const queued = service.enqueue({ ...answer(102), endType: 'manual' });

    await expect(queued.ready).resolves.toEqual(
      expect.objectContaining({
        answers: [{ ...answer(102), endType: 'manual' }],
      }),
    );
  });

  it('연속으로 들어온 답변은 병합되지 않고 각각 별도 묶음으로 즉시 처리된다', async () => {
    const first = service.enqueue(answer(102));
    const second = service.enqueue(answer(103));

    // 첫 답변이 도착 즉시 확정돼 큐에서 빠지므로, 뒤이어 온 답변은 병합 대상이
    // 아니라 새 묶음의 owner가 된다(예전엔 3초 대기 창 안에서 병합됐었다).
    expect(second.isBatchOwner).toBe(true);
    await expect(first.ready).resolves.toEqual(
      expect.objectContaining({ answers: [answer(102)] }),
    );
    await expect(second.ready).resolves.toEqual(
      expect.objectContaining({ answers: [answer(103)] }),
    );
  });

  it('flush를 명시적으로 다시 호출해도(이미 확정된 뒤라) 안전하게 무시된다', async () => {
    const queued = service.enqueue(answer(102));
    // ChatEndHandler 등이 대화 종료 시 방어적으로 호출하는 경로 — 이미 확정된
    // 뒤라 아무 효과도 없어야 한다(예외를 던지지 않고 조용히 무시).
    expect(() => service.flush(101, false)).not.toThrow();
    await expect(queued.ready).resolves.toEqual(
      expect.objectContaining({ continueConversation: true }),
    );
  });

  it('한 질문에는 최대 5개 답변만 등록한다(대기 없이도 누적 개수로 제한)', () => {
    for (let index = 0; index < MAX_ANSWER_SEGMENTS_PER_QUESTION; index += 1) {
      service.enqueue(answer(102 + index));
    }
    expect(() => service.enqueue(answer(200))).toThrow(
      QuestionAnswerQueueLimitError,
    );
  });

  it('한 질문의 전체 음성은 30MB를 초과할 수 없다(대기 없이도 누적 용량으로 제한)', () => {
    for (let index = 0; index < 3; index += 1) {
      service.enqueue({
        ...answer(102 + index),
        audioBuffer: Buffer.alloc(10 * 1024 * 1024),
      });
    }
    expect(() =>
      service.enqueue({ ...answer(200), audioBuffer: Buffer.alloc(1) }),
    ).toThrow(QuestionAnswerQueueLimitError);
    expect(MAX_ANSWER_AUDIO_BYTES_PER_QUESTION).toBe(30 * 1024 * 1024);
  });
});
