import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchConversationCalendar } from '../api'
import { getCalendarDates, isSameDate, toDateKey } from '../lib'
import { ATTENDANCE_CALENDAR_QUERY_KEY } from '../model'
import styles from './ViewAttendanceCalendarAction.module.css'

const weekDays = ['일', '월', '화', '수', '목', '금', '토']

export function ViewAttendanceCalendarAction() {
  const navigate = useNavigate()
  const today = new Date()
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  )
  const year = visibleMonth.getFullYear()
  const month = visibleMonth.getMonth()
  const calendarDates = getCalendarDates(year, month)

  const calendarQuery = useQuery({
    queryKey: [ATTENDANCE_CALENDAR_QUERY_KEY, year, month],
    queryFn: () => fetchConversationCalendar(year, month + 1),
  })
  const attendedDates = calendarQuery.data

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
          const dateKey = toDateKey(date)
          const isAttended = !isOutsideMonth && (attendedDates?.has(dateKey) ?? false)

          return (
            <button
              type="button"
              className={`${styles.date} ${isToday ? styles.today : ''} ${
                isOutsideMonth ? styles.outsideMonth : ''
              } ${isAttended ? styles.completed : ''}`}
              key={dateKey}
              aria-current={isToday ? 'date' : undefined}
              aria-label={`${date.getMonth() + 1}월 ${date.getDate()}일${isToday ? ', 오늘' : ''}${
                isAttended ? ', 대화 완료' : ''
              } 대화 기록 보기`}
              onClick={() => navigate(`/senior/daily-record?date=${dateKey}`)}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>

      <div className={styles.legend}>
        <span>
          <i className={styles.completedSample} aria-hidden="true" /> 대화 완료
        </span>
      </div>
    </section>
  )
}
