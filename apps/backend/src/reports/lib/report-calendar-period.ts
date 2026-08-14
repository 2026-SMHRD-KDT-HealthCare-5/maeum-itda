/* 역할: 연·월 입력을 DB DATE 비교에 사용할 반개구간 문자열로 변환한다. */
export interface ReportCalendarPeriod {
  monthStart: string;
  nextMonthStart: string;
}

export function toReportCalendarPeriod(
  year: number,
  month: number,
): ReportCalendarPeriod {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    monthStart,
    nextMonthStart: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
  };
}

export function addCalendarDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function toCalendarDateString(value: string | Date): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  // MySQL DATE는 시각이 없는 값이다. UTC 변환으로 날짜가 하루 밀리지 않게 로컬 구성요소를 사용한다.
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
