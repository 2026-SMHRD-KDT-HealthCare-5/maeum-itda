import {
  ADDITIONAL_ANSWER_WAIT_MS,
  MAX_ANSWER_AUDIO_BYTES_PER_QUESTION,
  MAX_ANSWER_SEGMENTS_PER_QUESTION,
  QuestionAnswerQueueLimitError,
  QuestionAnswerQueueService,
} from './question-answer-queue.service';
import type { QueuedAnswerSegment } from '../analysis/dto/audio-analysis.contract';

describe('QuestionAnswerQueueService', () => {
  let service: QuestionAnswerQueueService;

  beforeEach(() => {
    jest.useFakeTimers();
    service = new QuestionAnswerQueueService();
  });

  afterEach(() => jest.useRealTimers());

  const answer = (messageId: number): QueuedAnswerSegment => ({
    messageId,
    seniorId: 7,
    questionMessageId: 101,
    generationId: 'generation-001',
    audioTransferId: `audio-${messageId}`,
    mimeType: 'audio/webm',
    capturedAt: '2026-08-11T00:00:00.000Z',
    endType: 'auto',
    audioBuffer: Buffer.from([messageId]),
    continueConversation: true,
  });

  it('추가 답변이 들어오면 10초 타이머를 갱신하고 순서대로 묶는다', async () => {
    const first = service.enqueue(answer(102));
    expect(first.isBatchOwner).toBe(true);

    jest.advanceTimersByTime(4_000);
    const second = service.enqueue(answer(103));
    expect(second.isBatchOwner).toBe(false);

    jest.advanceTimersByTime(9_999);
    let resolved = false;
    void first.ready.then(() => (resolved = true));
    await Promise.resolve();
    expect(resolved).toBe(false);

    jest.advanceTimersByTime(1);
    await expect(first.ready).resolves.toEqual(
      expect.objectContaining({
        questionMessageId: 101,
        answers: [answer(102), answer(103)],
      }),
    );
  });

  it('flush 호출 시 대기 시간 전에 묶음을 확정한다', async () => {
    const queued = service.enqueue(answer(102));
    service.flush(101);
    await expect(queued.ready).resolves.toEqual(
      expect.objectContaining({ answers: [answer(102)] }),
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it('기본 추가 답변 대기 시간은 10초다', () => {
    expect(ADDITIONAL_ANSWER_WAIT_MS).toBe(10_000);
  });
  it('대화 종료 flush는 분석 후 다음 질문을 생성하지 않도록 표시한다', async () => {
    const queued = service.enqueue(answer(102));
    service.flush(101, false);
    await expect(queued.ready).resolves.toEqual(
      expect.objectContaining({ continueConversation: false }),
    );
  });

  it('한 질문에는 최대 5개 답변만 등록한다', () => {
    for (let index = 0; index < MAX_ANSWER_SEGMENTS_PER_QUESTION; index += 1) {
      service.enqueue(answer(102 + index));
    }
    expect(() => service.enqueue(answer(200))).toThrow(
      QuestionAnswerQueueLimitError,
    );
  });

  it('한 질문의 전체 음성은 30MB를 초과할 수 없다', () => {
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
