const weekDays = ['일', '월', '화', '수', '목', '금', '토']

// toDateKey/isSameDate/getCalendarDates는 select-daily-record-date와 완전히 같은
// 로직을 복제하고 있어 shared/lib로 옮겼다(ui/index.tsx가 거기서 직접 import).
export function formatKoreanDate(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${weekDays[date.getDay()]})`
}
