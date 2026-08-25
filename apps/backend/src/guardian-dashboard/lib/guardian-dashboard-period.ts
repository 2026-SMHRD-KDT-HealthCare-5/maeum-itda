/* 역할: 보호자 홈이 사용하는 서울 기준 오늘과 최근 7개 달력 날짜를 계산한다. */
const SEOUL_TIME_ZONE = 'Asia/Seoul';

function formatSeoulDate(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export interface GuardianDashboardPeriod {
  reportDate: string;
  startDate: string;
  dates: string[];
}

export function toGuardianDashboardPeriod(
  now = new Date(),
): GuardianDashboardPeriod {
  const today = formatSeoulDate(now);
  const reportDate = today;
  const startDate = addDays(reportDate, -6);
  return {
    reportDate,
    startDate,
    dates: Array.from({ length: 7 }, (_, index) => addDays(startDate, index)),
  };
}

export function calculateDaysTogether(
  connectedAt: Date,
  now = new Date(),
): number {
  const connectedDate = formatSeoulDate(connectedAt);
  const today = formatSeoulDate(now);
  const milliseconds =
    new Date(`${today}T00:00:00.000Z`).getTime() -
    new Date(`${connectedDate}T00:00:00.000Z`).getTime();
  return Math.max(1, Math.floor(milliseconds / 86_400_000) + 1);
}
