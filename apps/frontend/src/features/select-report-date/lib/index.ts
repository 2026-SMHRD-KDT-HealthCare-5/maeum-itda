const weekDays = ['일', '월', '화', '수', '목', '금', '토']

export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatKoreanDate(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${weekDays[date.getDay()]})`
}

export function isSameDate(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

export function getCalendarDates(year: number, month: number): Date[] {
  const firstDate = new Date(year, month, 1)
  const lastDate = new Date(year, month + 1, 0)
  const startDate = new Date(year, month, 1 - firstDate.getDay())
  const endOffset = 6 - lastDate.getDay()
  const endDate = new Date(year, month, lastDate.getDate() + endOffset)
  const dates: Date[] = []

  for (const date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    dates.push(new Date(date))
  }

  return dates
}
