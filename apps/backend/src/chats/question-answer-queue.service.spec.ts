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

  it('추가 답변이 들어오면 대기 타이머를 갱신하고 순서대로 묶는다', async () => {
    const first = service.enqueue(answer(102));
    expect(first.isBatchOwner).toBe(true);

    jest.advanceTimersByTime(ADDITIONAL_ANSWER_WAIT_MS - 1);
    const second = service.enqueue(answer(103));
    expect(second.isBatchOwner).toBe(false);

    jest.advanceTimersByTime(ADDITIONAL_ANSWER_WAIT_MS - 1);
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

  it('기본 추가 답변 대기 시간은 3초다', () => {
    expect(ADDITIONAL_ANSWER_WAIT_MS).toBe(3_000);
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

  it('endType이 manual이면 10초를 기다리지 않고 즉시 확정한다', async () => {
    const queued = service.enqueue({ ...answer(102), endType: 'manual' });

    await expect(queued.ready).resolves.toEqual(
      expect.objectContaining({
        answers: [{ ...answer(102), endType: 'manual' }],
      }),
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it('추가 답변이 manual로 오면 그 시점에 바로 확정한다(대기 시간 안 기다림)', async () => {
    const first = service.enqueue(answer(102));
    jest.advanceTimersByTime(ADDITIONAL_ANSWER_WAIT_MS - 1_000);

    const second = service.enqueue({ ...answer(103), endType: 'manual' });
    expect(second.isBatchOwner).toBe(false);

    await expect(first.ready).resolves.toEqual(
      expect.objectContaining({
        answers: [answer(102), { ...answer(103), endType: 'manual' }],
      }),
    );
    expect(jest.getTimerCount()).toBe(0);
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
