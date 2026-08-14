/* 역할: 서울 기준 월요일 weekStart로 월~일 7일 날짜 범위를 생성한다. */
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export interface WeeklyReportPeriod {
  weekStart: string;
  weekEnd: string;
  dates: string[];
}

export function toWeeklyReportPeriod(weekStart: string): WeeklyReportPeriod {
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || formatDate(start) !== weekStart) {
    throw new Error('유효한 주 시작일이 아닙니다.');
  }
  if (start.getUTCDay() !== 1) {
    throw new Error('weekStart는 월요일이어야 합니다.');
  }

  const dates = Array.from({ length: 7 }, (_, index) =>
    formatDate(new Date(start.getTime() + index * DAY_IN_MILLISECONDS)),
  );
  return { weekStart, weekEnd: dates[6], dates };
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
