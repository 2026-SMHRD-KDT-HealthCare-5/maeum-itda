import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './ViewAttendanceCalendarAction.module.css'

const weekDays = ['일', '월', '화', '수', '목', '금', '토']

function getCalendarDates(year: number, month: number) {
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

function isSameDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

export function ViewAttendanceCalendarAction() {
  const navigate = useNavigate()
  const today = new Date()
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  )
  const year = visibleMonth.getFullYear()
  const month = visibleMonth.getMonth()
  const calendarDates = getCalendarDates(year, month)

  const moveMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  return (
    <section className={styles.card} aria-labelledby="attendance-title">
      <header className={styles.header}>
        <h2 id="attendance-title">출석 캘린더</h2>
      </header>

      <div className={styles.monthNavigation}>
        <button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달 보기">
          ‹
        </button>
        <strong aria-live="polite">
          {year}년 {month + 1}월
        </strong>
        <button type="button" onClick={() => moveMonth(1)} aria-label="다음 달 보기">
          ›
        </button>
      </div>

      <div className={styles.calendar} aria-label={`${year}년 ${month + 1}월 출석 캘린더`}>
        {weekDays.map((day) => (
          <span className={styles.weekDay} key={day}>
            {day}
          </span>
        ))}
        {calendarDates.map((date) => {
          const isToday = isSameDate(date, today)
          const isOutsideMonth = date.getMonth() !== month

          return (
            <button
              type="button"
              className={`${styles.date} ${isToday ? styles.today : ''} ${
                isOutsideMonth ? styles.outsideMonth : ''
              }`}
              key={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
              aria-current={isToday ? 'date' : undefined}
              aria-label={`${date.getMonth() + 1}월 ${date.getDate()}일${isToday ? ', 오늘' : ''} 대화 기록 보기`}
              onClick={() => {
                const dateKey = [
                  date.getFullYear(),
                  String(date.getMonth() + 1).padStart(2, '0'),
                  String(date.getDate()).padStart(2, '0'),
                ].join('-')
                navigate(`/senior/daily-record?date=${dateKey}`)
              }}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>

      <div className={styles.legend}>
        <span>
          <i className={styles.completedSample} aria-hidden="true">
            ✓
          </i>{' '}
          대화 완료
        </span>
        <span>
          <i className={styles.pendingSample} aria-hidden="true" /> 아직 대화 전
        </span>
      </div>
    </section>
  )
}
