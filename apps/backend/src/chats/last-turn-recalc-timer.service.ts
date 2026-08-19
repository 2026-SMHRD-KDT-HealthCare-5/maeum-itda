/*
역할: 시니어의 마지막 턴(질문 전달) 이후 10분 동안 새 턴(재접속/다음 질문)이
없으면 그날 정서지수를 재계산한다.
연결 흐름: ChatStartHandler/AudioBinaryHandler(새 질문 전달 시점마다) → arm(seniorId)
→ 10분 안에 다시 arm되지 않으면 EmotionIndexRecalcTriggerService.recalcToday 실행.
[완료] chat:end/유휴 타임아웃의 즉시 재계산과 달리 WebSocket 연결 객체 생존 여부와
무관하게(seniorId 기준 setTimeout) 동작해, 재연결 없이 조용히 끊긴 연결도 잡아낸다.
[제약] 단일 인스턴스 메모리 기준이라 서버 재시작 시 타이머가 사라지고 다른 서버와 공유되지 않는다(결정사항 로그 §0).
*/
import { Injectable } from '@nestjs/common';
import { EmotionIndexRecalcTriggerService } from '../reports/emotion-index-recalc-trigger.service';

export const LAST_TURN_RECALC_DELAY_MS = 10 * 60_000;

@Injectable()
export class LastTurnRecalcTimerService {
  private readonly timersBySeniorId = new Map<number, NodeJS.Timeout>();

  constructor(
    private readonly recalcTriggerService: EmotionIndexRecalcTriggerService,
  ) {}

  // 역할: 새 턴이 있을 때마다(최초 시작, 매 다음 질문, 재접속) 10분 타이머를 다시 시작한다.
  arm(seniorId: number): void {
    const existing = this.timersBySeniorId.get(seniorId);
    if (existing !== undefined) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.timersBySeniorId.delete(seniorId);
      this.recalcTriggerService.recalcToday(seniorId);
    }, LAST_TURN_RECALC_DELAY_MS);
    // 10분짜리 타이머가 프로세스 종료(서버 셧다운, 테스트 종료)를 붙잡지 않게 한다 —
    // ChatInactivityService의 30초/2분 타이머와 달리 이건 굳이 프로세스를 살려둘
    // 만큼 급하지 않다.
    timer.unref();
    this.timersBySeniorId.set(seniorId, timer);
  }

  // [완료] 대화가 명시적으로 종료되면 예약된 재계산을 제거해 중복 집계를 막는다.
  cancel(seniorId: number): void {
    const timer = this.timersBySeniorId.get(seniorId);
    if (timer === undefined) return;

    clearTimeout(timer);
    this.timersBySeniorId.delete(seniorId);
  }
}
