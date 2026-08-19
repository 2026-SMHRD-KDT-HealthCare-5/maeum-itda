/* 역할: 실행 시각을 Asia/Seoul 기준 "HH:mm"으로 바꿔 안부 알림 리마인더 시각과 비교한다. */
const SEOUL_OFFSET_MILLISECONDS = 9 * 60 * 60 * 1000;

export function toSeoulHourMinute(now: Date): string {
  const seoulClock = new Date(now.getTime() + SEOUL_OFFSET_MILLISECONDS);
  const hours = String(seoulClock.getUTCHours()).padStart(2, '0');
  const minutes = String(seoulClock.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
