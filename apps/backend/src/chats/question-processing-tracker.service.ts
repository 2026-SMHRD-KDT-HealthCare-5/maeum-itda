/*
역할: 질문(questionMessageId)별로 진행 중인 답변 분석·저장 작업의 완료 여부를 추적한다.
연결 흐름: AudioBinaryHandler.scheduleBatch() → track() 등록 → ChatEndHandler/
          ChatInactivityService가 종료 처리 중 waitFor()로 그 완료를 기다린다.
[배경] AudioBinaryHandler는 이미 ChatInactivityService에 의존하고 있어, 종료 처리
쪽에서 AudioBinaryHandler를 직접 참조하면 순환 의존이 생긴다. 이 서비스는 양쪽 모두
의존할 수 있는 독립적인 leaf 서비스로 분리해 그 문제를 피한다.
*/
import { Injectable } from '@nestjs/common';

@Injectable()
export class QuestionProcessingTrackerService {
  private readonly processingByQuestionMessageId = new Map<
    number,
    Promise<void>
  >();

  // 역할: 같은 질문에 늦게 도착한 추가 묶음은 앞선 처리 뒤에 순서대로 실행되도록
  // 이어붙이고, 그 결과 Promise를 질문별로 최신 상태로 유지한다.
  track(
    questionMessageId: number,
    process: () => Promise<void>,
  ): Promise<void> {
    const previous =
      this.processingByQuestionMessageId.get(questionMessageId) ??
      Promise.resolve();
    const current = previous.then(process);
    this.processingByQuestionMessageId.set(questionMessageId, current);
    // finally()가 만드는 새 Promise는 current의 실패를 그대로 이어받는다 —
    // 정리 작업 자체의 체인이 처리되지 않은 rejection으로 남지 않도록 별도로
    // 삼킨다(current 자체는 그대로 반환해 호출자가 성공/실패를 알 수 있다).
    current
      .finally(() => {
        if (
          this.processingByQuestionMessageId.get(questionMessageId) === current
        ) {
          this.processingByQuestionMessageId.delete(questionMessageId);
        }
      })
      .catch(() => undefined);
    return current;
  }

  // 역할: 그 질문에 현재 진행 중인 작업이 없으면 즉시, 있으면 끝날 때까지 기다린다.
  // 진행 중 작업이 실패해도(예: FastAPI 오류) 종료 처리 흐름을 막지 않도록 삼킨다 —
  // 실패 시 AudioBinaryHandler가 이미 error 이벤트로 알리는 별개의 책임이다.
  async waitFor(questionMessageId: number): Promise<void> {
    const pending = this.processingByQuestionMessageId.get(questionMessageId);
    if (pending === undefined) return;
    await pending.catch(() => undefined);
  }
}
