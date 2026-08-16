/* 역할: 마지막 턴 후 10분 안에 재호출 없으면 재계산을 트리거하고, 재호출되면 타이머가 리셋되는지 검증한다. */
import {
  LAST_TURN_RECALC_DELAY_MS,
  LastTurnRecalcTimerService,
} from './last-turn-recalc-timer.service';
import type { EmotionIndexRecalcTriggerService } from '../reports/emotion-index-recalc-trigger.service';

describe('LastTurnRecalcTimerService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function createService() {
    const recalcToday = jest.fn();
    const service = new LastTurnRecalcTimerService({
      recalcToday,
    } as unknown as EmotionIndexRecalcTriggerService);
    return { service, recalcToday };
  }

  it('10분 안에 재호출 없으면 재계산을 실행한다', () => {
    const { service, recalcToday } = createService();

    service.arm(7);
    jest.advanceTimersByTime(LAST_TURN_RECALC_DELAY_MS);

    expect(recalcToday).toHaveBeenCalledWith(7);
  });

  it('10분 전에 다시 arm되면 타이머가 리셋되어 원래 시점에는 실행되지 않는다', () => {
    const { service, recalcToday } = createService();

    service.arm(7);
    jest.advanceTimersByTime(LAST_TURN_RECALC_DELAY_MS - 1_000);
    service.arm(7);
    jest.advanceTimersByTime(LAST_TURN_RECALC_DELAY_MS - 1_000);

    expect(recalcToday).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1_000);
    expect(recalcToday).toHaveBeenCalledTimes(1);
  });

  it('시니어별로 독립된 타이머를 유지한다', () => {
    const { service, recalcToday } = createService();

    service.arm(7);
    jest.advanceTimersByTime(5 * 60_000);
    service.arm(8);
    jest.advanceTimersByTime(5 * 60_000);

    expect(recalcToday).toHaveBeenCalledWith(7);
    expect(recalcToday).not.toHaveBeenCalledWith(8);
  });
});
