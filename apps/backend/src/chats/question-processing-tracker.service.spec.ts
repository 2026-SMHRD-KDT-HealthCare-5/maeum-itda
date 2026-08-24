/* 역할: 질문별 진행 중 작업 추적·대기가 순서와 완료 시점을 올바르게 반영하는지 검증한다. */
import { QuestionProcessingTrackerService } from './question-processing-tracker.service';

describe('QuestionProcessingTrackerService', () => {
  it('진행 중인 작업이 없으면 즉시 반환한다', async () => {
    const tracker = new QuestionProcessingTrackerService();
    await expect(tracker.waitFor(101)).resolves.toBeUndefined();
  });

  it('진행 중인 작업이 끝날 때까지 기다린다', async () => {
    const tracker = new QuestionProcessingTrackerService();
    let resolveProcess!: () => void;
    const process = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveProcess = resolve;
        }),
    );

    void tracker.track(101, process);

    let waited = false;
    const waitPromise = tracker.waitFor(101).then(() => {
      waited = true;
    });

    await Promise.resolve();
    expect(waited).toBe(false);

    resolveProcess();
    await waitPromise;
    expect(waited).toBe(true);
  });

  it('같은 질문에 늦게 들어온 작업은 앞선 작업 뒤에 순서대로 실행된다', async () => {
    const tracker = new QuestionProcessingTrackerService();
    const order: string[] = [];
    let resolveFirst!: () => void;

    void tracker.track(101, () =>
      new Promise<void>((resolve) => {
        resolveFirst = resolve;
      }).then(() => {
        order.push('first');
      }),
    );
    const second = tracker.track(101, () => {
      order.push('second');
      return Promise.resolve();
    });

    // track()의 previous.then(process)는 previous가 이미 resolve된 상태여도
    // process() 실행을 마이크로태스크 한 틱 뒤로 미룬다 — resolveFirst가
    // 실제로 대입되는 시점도 그 뒤이므로 한 틱 흘려보낸 뒤에 호출해야 한다.
    await Promise.resolve();
    resolveFirst();
    await second;

    expect(order).toEqual(['first', 'second']);
  });

  it('진행 중이던 작업이 실패해도 waitFor는 거부되지 않고 정리된다', async () => {
    const tracker = new QuestionProcessingTrackerService();
    const tracked = tracker.track(101, () =>
      Promise.reject(new Error('FastAPI 오류')),
    );

    await expect(tracker.waitFor(101)).resolves.toBeUndefined();
    await expect(tracked).rejects.toThrow('FastAPI 오류');

    // 완료(성공/실패 무관) 후에는 더 이상 대기 대상이 없어야 한다.
    await Promise.resolve();
    await expect(tracker.waitFor(101)).resolves.toBeUndefined();
  });
});
