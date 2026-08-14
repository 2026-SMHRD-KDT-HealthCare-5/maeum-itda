/* 역할: Asia/Seoul 업무 날짜를 DB의 UTC 조회 구간으로 안전하게 변환한다. */
const REPORT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SEOUL_OFFSET = '+09:00';

export interface UtcDateRange {
  start: Date;
  end: Date;
}

export function toSeoulBusinessDayUtcRange(reportDate: string): UtcDateRange {
  if (!REPORT_DATE_PATTERN.test(reportDate)) {
    throw new Error('리포트 날짜는 YYYY-MM-DD 형식이어야 합니다.');
  }

  const start = new Date(`${reportDate}T00:00:00.000${SEOUL_OFFSET}`);
  if (Number.isNaN(start.getTime()) || formatSeoulDate(start) !== reportDate) {
    throw new Error('존재하지 않는 리포트 날짜입니다.');
  }

  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

function formatSeoulDate(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}
