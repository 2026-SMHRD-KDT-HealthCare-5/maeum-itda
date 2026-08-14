/* 역할: 실행 시각을 Asia/Seoul 업무 날짜로 바꿔 전날 일간 날짜와 월요일 주간 시작일을 계산한다. */
const SEOUL_OFFSET_MILLISECONDS = 9 * 60 * 60 * 1000;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export interface ReportScheduleContext {
  reportDate: string;
  previousWeekStart: string | null;
}

export function toReportScheduleContext(now: Date): ReportScheduleContext {
  const seoulClock = new Date(now.getTime() + SEOUL_OFFSET_MILLISECONDS);
  const reportDate = formatUtcDate(
    new Date(seoulClock.getTime() - DAY_IN_MILLISECONDS),
  );

  return {
    reportDate,
    previousWeekStart:
      seoulClock.getUTCDay() === 1
        ? formatUtcDate(
            new Date(seoulClock.getTime() - 7 * DAY_IN_MILLISECONDS),
          )
        : null,
  };
}

function formatUtcDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
