/* 역할: 서울 기준 일·월을 UTC 저장 메시지의 반개구간 조회 범위로 변환한다. */
const SEOUL_OFFSET = '+09:00';

export interface ChatDateRange {
  start: Date;
  end: Date;
}

export function toChatDayUtcRange(date: string): ChatDateRange {
  const start = new Date(`${date}T00:00:00.000${SEOUL_OFFSET}`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export function toChatMonthUtcRange(
  year: number,
  month: number,
): ChatDateRange {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextMonthStart = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  return {
    start: new Date(`${monthStart}T00:00:00.000${SEOUL_OFFSET}`),
    end: new Date(`${nextMonthStart}T00:00:00.000${SEOUL_OFFSET}`),
  };
}
