import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { FiCheck } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { fetchConversationCalendar } from '../api'
import { getCalendarDates, isSameDate, toDateKey } from '../lib'
import { ATTENDANCE_CALENDAR_QUERY_KEY } from '../model'
import styles from './ViewAttendanceCalendarAction.module.css'

const weekDays = ['일', '월', '화', '수', '목', '금', '토']

export function ViewAttendanceCalendarAction() {
  const navigate = useNavigate()
  const today = new Date()
  const todayKey = toDateKey(today)
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  )
  const year = visibleMonth.getFullYear()
  const month = visibleMonth.getMonth()
  const calendarDates = getCalendarDates(year, month)
  const isViewingCurrentMonth = year === today.getFullYear() && month === today.getMonth()

  const calendarQuery = useQuery({
    queryKey: [ATTENDANCE_CALENDAR_QUERY_KEY, year, month],
    queryFn: () => fetchConversationCalendar(year, month + 1),
  })
  // 조회가 끝나기 전에는 어떤 날짜도 "대화함"으로 단정하지 않는다 — 그렇지
  // 않으면 전부 무표시로 그려졌다가 응답이 오는 순간 표시가 팝인해 보인다.
  const attendedDates = calendarQuery.isSuccess ? calendarQuery.data : undefined
  const attendedCount = attendedDates?.size ?? 0
  const isTodayAttended = isViewingCurrentMonth && (attendedDates?.has(todayKey) ?? false)
  const monthLabel = isViewingCurrentMonth ? '이번 달' : `${month + 1}월`

  // 오늘 상태 기준의 격려 문구라 다른 달을 보는 중에는 보여주지 않는다.
  // 빠진 날을 실패처럼 느끼지 않도록, 못 채운 날이 있어도 다그치는 대신
  // 부담 없이 다시 시작하자는 톤을 유지한다.
  const encouragement = !isViewingCurrentMonth
    ? null
    : isTodayAttended
      ? '오늘 대화 완료! 다슬이가 기뻐하고 있어요'
      : attendedCount > 0
        ? '쉬어간 날이 있어도 괜찮아요. 오늘 다시 이야기해요'
        : '다슬이가 오늘 이야기를 기다리고 있어요'

  const moveMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  return (
    <section className={styles.card} aria-labelledby="attendance-title">
      <header className={styles.header}>
        <h2 id="attendance-title">{monthLabel} 안부 대화</h2>
        {attendedCount > 0 && (
          <p className={styles.monthSummary}>
            {monthLabel}에는 다슬이와 {attendedCount}번 이야기했어요
          </p>
        )}
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

      <div className={styles.calendar} aria-label={`${year}년 ${month + 1}월 안부 대화 기록`}>
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
          const isTodayCell = !isOutsideMonth && isToday

          return (
            <button
              type="button"
              className={[
                styles.date,
                isOutsideMonth && styles.outsideMonth,
                isTodayCell && isAttended && styles.todayCompleted,
                isTodayCell && !isAttended && styles.todayPending,
                !isTodayCell && isAttended && styles.completed,
              ]
                .filter(Boolean)
                .join(' ')}
              key={dateKey}
              aria-current={isToday ? 'date' : undefined}
              aria-label={`${date.getMonth() + 1}월 ${date.getDate()}일${isToday ? ', 오늘' : ''}${
                isAttended ? ', 대화 완료' : ''
              } 대화 기록 보기`}
              onClick={() => navigate(`/senior/daily-record?date=${dateKey}`)}
            >
              {date.getDate()}
              {isTodayCell && isAttended && (
                <FiCheck className={styles.completedIcon} aria-hidden="true" />
              )}
            </button>
          )
        })}
      </div>

      {encouragement && (
        <p className={styles.encouragement} role="status">
          {encouragement}
        </p>
      )}

      <div className={styles.legend}>
        <span>
          <i className={styles.completedSample} aria-hidden="true" /> 대화 완료
        </span>
        <span>
          <i className={styles.pendingSample} aria-hidden="true" /> 오늘
        </span>
      </div>
    </section>
  )
}
