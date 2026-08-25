/* 역할: 동시성 한도 준수, 전체 항목 처리, 개별 실패 시 계속 진행 후 집계 실패를 검증한다. */
import { runWithConcurrency } from './run-with-concurrency';

describe('runWithConcurrency', () => {
  it('동시 실행 개수가 limit을 넘지 않는다', async () => {
    const items = [1, 2, 3, 4, 5, 6];
    const limit = 2;
    let inFlight = 0;
    let maxInFlight = 0;

    await runWithConcurrency(items, limit, async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
    });

    expect(maxInFlight).toBeLessThanOrEqual(limit);
  });

  it('모든 항목을 빠짐없이 처리한다', async () => {
    const items = [1, 2, 3, 4, 5];
    const processed: number[] = [];

    await runWithConcurrency(items, 3, (item) => {
      processed.push(item);
      return Promise.resolve();
    });

    expect(processed.sort()).toEqual(items);
  });

  it('일부 항목이 실패해도 나머지 항목 처리를 막지 않는다', async () => {
    const items = [1, 2, 3, 4];
    const processed: number[] = [];

    await expect(
      runWithConcurrency(items, 2, (item) => {
        if (item === 2) throw new Error('boom');
        processed.push(item);
        return Promise.resolve();
      }),
    ).rejects.toThrow(AggregateError);

    expect(processed.sort()).toEqual([1, 3, 4]);
  });

  it('limit이 항목 수보다 커도 정상 동작한다', async () => {
    const items = [1, 2];
    const processed: number[] = [];

    await runWithConcurrency(items, 10, (item) => {
      processed.push(item);
      return Promise.resolve();
    });

    expect(processed.sort()).toEqual(items);
  });
});
