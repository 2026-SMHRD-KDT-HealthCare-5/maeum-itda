import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnimatedPresence } from '../../../shared/lib'
import styles from './SelectReportWeekAction.module.css'

interface SelectReportWeekActionProps {
  weekStart: string
  weeksWithReport: Set<string>
  // 모달에서 보고 있는 달이 바뀔 때마다 알려준다 — 부모가 이 달 기준으로
  // weeksWithReport를 새로 가져오지 않으면, 선택된 주의 달과 다른 달로
  // 넘겼을 때 그 달의 "리포트 있음" 점이 안 찍힌 채로 남는다.
  onVisibleMonthChange?: (month: Date) => void
}

const DAY_IN_MS = 24 * 60 * 60 * 1000
const weekDays = ['일', '월', '화', '수', '목', '금', '토']

// 주간 리포트 라우트의 weekStart는 월요일 날짜다. 날짜 계산은 UTC 자정에서
// 처리해 브라우저 시간대에 따른 밀림을 막고, 달력에서 고른 날도 해당 주의
// 월요일로 정규화해 페이지 라우트와 주간 데이터 조회 기준을 일치시킨다.
function parseDateKey(dateKey: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null

  const date = new Date(`${dateKey}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function moveDate(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_IN_MS)
}

function startOfWeek(date: Date): Date {
  const day = date.getUTCDay()
  return moveDate(date, day === 0 ? -6 : 1 - day)
}

function formatWeekRange(weekStart: Date): string {
  const weekEnd = moveDate(weekStart, 6)
  const startMonth = weekStart.getUTCMonth() + 1
  const startDay = weekStart.getUTCDate()
  const endMonth = weekEnd.getUTCMonth() + 1
  const endDay = weekEnd.getUTCDate()

  if (startMonth === endMonth) return `${startMonth}월 ${startDay}일 - ${endDay}일`
  return `${startMonth}월 ${startDay}일 - ${endMonth}월 ${endDay}일`
}

function getCalendarDates(year: number, month: number): Date[] {
  const firstDate = new Date(Date.UTC(year, month, 1))
  const calendarStart = moveDate(firstDate, -firstDate.getUTCDay())
  return Array.from({ length: 42 }, (_, index) => moveDate(calendarStart, index))
}

export function SelectReportWeekAction({
  weekStart,
  weeksWithReport,
  onVisibleMonthChange,
}: SelectReportWeekActionProps) {
  const navigate = useNavigate()
  const selectedWeek = parseDateKey(weekStart)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const calendarPresence = useAnimatedPresence(isCalendarOpen)
  const [visibleMonth, setVisibleMonth] = useState(() => selectedWeek ?? new Date())

  function selectWeek(date: Date) {
    navigate(`/guardian/report/weekly/${toDateKey(startOfWeek(date))}`)
    setIsCalendarOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openCalendar() {
    if (!selectedWeek) return
    setVisibleMonth(selectedWeek)
    onVisibleMonthChange?.(selectedWeek)
    setIsCalendarOpen(true)
  }

  function moveMonth(offset: number) {
    const next = new Date(Date.UTC(year, month + offset, 1))
    setVisibleMonth(next)
    onVisibleMonthChange?.(next)
  }

  useEffect(() => {
    if (!isCalendarOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsCalendarOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [isCalendarOpen])

  if (!selectedWeek) return <p className={styles.invalidDate}>올바르지 않은 주간 날짜예요.</p>

  const year = visibleMonth.getUTCFullYear()
  const month = visibleMonth.getUTCMonth()
  const calendarDates = getCalendarDates(year, month)
  const selectedEnd = moveDate(selectedWeek, 6)

  return (
    <>
      <div className={styles.pill}>
        <button
          type="button"
          className={styles.arrowButton}
          onClick={() => selectWeek(moveDate(selectedWeek, -7))}
          aria-label="이전 주 리포트 보기"
        >
          ‹
        </button>
        <button type="button" className={styles.dateButton} onClick={openCalendar}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="4" y="5" width="16" height="16" rx="3" />
            <path d="M4 9.5h16M8 3v3.5M16 3v3.5" />
          </svg>
          {formatWeekRange(selectedWeek)}
        </button>
        <button
          type="button"
          className={styles.arrowButton}
          onClick={() => selectWeek(moveDate(selectedWeek, 7))}
          aria-label="다음 주 리포트 보기"
        >
          ›
        </button>
      </div>

      {calendarPresence.isRendered && (
        <div
          className={`${styles.modalOverlay} ${calendarPresence.isClosing ? styles.modalOverlayClosing : ''}`}
          onClick={() => setIsCalendarOpen(false)}
        >
          <div
            className={`${styles.modal} ${calendarPresence.isClosing ? styles.modalClosing : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label="주간 리포트 날짜 선택"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.monthNav}>
              <button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달">
                ‹
              </button>
              <strong>
                {year}년 {month + 1}월
              </strong>
              <button type="button" onClick={() => moveMonth(1)} aria-label="다음 달">
                ›
              </button>
            </div>

            <div className={styles.calendar}>
              {weekDays.map((day) => (
                <span className={styles.weekDay} key={day}>
                  {day}
                </span>
              ))}
              {calendarDates.map((date) => {
                const hasReport = weeksWithReport.has(toDateKey(startOfWeek(date)))
                const isSelected = date >= selectedWeek && date <= selectedEnd
                const weekDay = date.getUTCDay()
                const showsReportMarker = hasReport && weekDay === 1
                const isOutsideMonth = date.getUTCMonth() !== month
                return (
                  <button
                    type="button"
                    key={toDateKey(date)}
                    className={[
                      styles.dateCell,
                      isOutsideMonth ? styles.outsideMonth : '',
                      showsReportMarker ? styles.hasReport : '',
                      isSelected ? styles.selectedWeek : '',
                      isSelected && weekDay === 1 ? styles.selectedWeekStart : '',
                      isSelected && weekDay === 6 ? styles.selectedWeekRowEnd : '',
                      isSelected && weekDay === 0 ? styles.selectedWeekEnd : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-label={`${date.getUTCFullYear()}년 ${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일이 포함된 주 선택, 주간 리포트 ${hasReport ? '있음' : '없음'}`}
                    aria-pressed={isSelected}
                    onClick={() => selectWeek(date)}
                  >
                    {date.getUTCDate()}
                  </button>
                )
              })}
            </div>
            <div className={styles.legend}>
              <span className={styles.legendItem}>
                <i className={styles.reportLegendDot} aria-hidden="true" />
                주간 리포트 있음
              </span>
              <span className={styles.legendItem}>
                <i className={styles.selectedWeekLegend} aria-hidden="true" />
                선택한 주
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
