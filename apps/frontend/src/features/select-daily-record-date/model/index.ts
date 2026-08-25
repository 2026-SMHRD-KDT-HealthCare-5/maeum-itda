// isSameDate/toDateKey/getCalendarDates는 select-report-date와 완전히 같은
// 로직을 복제하고 있어 shared/lib로 옮겼다(ui/index.tsx가 거기서 직접 import).
export function formatKoreanDate(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`
}
