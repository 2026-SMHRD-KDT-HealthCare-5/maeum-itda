/*
역할: 배열을 정해진 동시성 한도 안에서 처리한다 — 전부 순차도, 전부 동시도 아닌 절충.
전체 흐름: ReportGenerationCoordinatorService.run() -> runWithConcurrency -> worker(item)
*/

// 항목이 끝나는 대로 다음 항목을 바로 이어받는 워커 풀 방식이라, 단순히 청크로
// 잘라 순차 실행하는 것보다 유리하다(한 청크 안의 느린 항목 하나가 다음 청크
// 시작을 막지 않는다). limit개의 워커가 공유 커서(index)를 두고 경쟁적으로
// 다음 항목을 가져간다.
//
// worker가 실패해도 그 워커 루프를 중단시키지 않고 계속 다음 항목을 처리한다
// (호출부가 개별 실패를 자체적으로 삼키는지 여부와 무관하게 항상 전체 항목을
// 끝까지 처리하도록 보장한다). 하나라도 실패가 있었다면 전부 끝난 뒤에
// AggregateError로 모아 던진다 — 실패를 조용히 숨기지 않으면서도, 이미 끝난
// 다른 항목의 진행을 막지 않는다.
export async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const errors: unknown[] = [];

  async function runWorker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        await worker(items[index]);
      } catch (error: unknown) {
        errors.push(error);
      }
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, runWorker));

  if (errors.length > 0) {
    throw new AggregateError(
      errors,
      `${errors.length}개 항목 처리 중 실패했습니다.`,
    );
  }
}
