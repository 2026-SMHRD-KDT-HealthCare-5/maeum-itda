import { useEffect, useState } from 'react'
import { formatKoreanDate, getCalendarDates, isSameDate, toDateKey } from '../lib'
import styles from './SelectReportDateAction.module.css'

const weekDays = ['일', '월', '화', '수', '목', '금', '토']

interface SelectReportDateActionProps {
  selectedDate: Date
  onSelectDate: (date: Date) => void
}

// GUARDIAN_REPORT_01 (UC-08) — 일간 리포트 날짜 네비게이션 + 캘린더 모달.
// features/select-daily-record-date와 같은 패턴을 이 feature 안에 자체
// 구현으로 복제했다(보호자 리포트는 대화-기록-있음 표시가 필요 없어 그
// 하이라이트 로직은 뺐다).
export function SelectReportDateAction({
  selectedDate,
  onSelectDate,
}: SelectReportDateActionProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  )

  function moveDay(offset: number) {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + offset)
    onSelectDate(next)
  }

  function moveMonth(offset: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  function openCalendar() {
    setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
    setIsCalendarOpen(true)
  }

  const year = visibleMonth.getFullYear()
  const month = visibleMonth.getMonth()
  const calendarDates = getCalendarDates(year, month)

  useEffect(() => {
    if (!isCalendarOpen) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsCalendarOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [isCalendarOpen])

  return (
    <>
      <div className={styles.pill}>
        <button
          type="button"
          className={styles.arrowButton}
          onClick={() => moveDay(-1)}
          aria-label="전날 리포트 보기"
        >
          ‹
        </button>
        <button type="button" className={styles.dateButton} onClick={openCalendar}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="4" y="5" width="16" height="16" rx="3" />
            <path d="M4 9.5h16M8 3v3.5M16 3v3.5" />
          </svg>
          {formatKoreanDate(selectedDate)}
        </button>
        <button
          type="button"
          className={styles.arrowButton}
          onClick={() => moveDay(1)}
          aria-label="다음날 리포트 보기"
        >
          ›
        </button>
      </div>

      {isCalendarOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsCalendarOpen(false)}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label="리포트 날짜 선택"
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
                const isSelected = isSameDate(date, selectedDate)
                const isOutsideMonth = date.getMonth() !== month

                return (
                  <button
                    type="button"
                    key={toDateKey(date)}
                    className={[
                      styles.dateCell,
                      isOutsideMonth ? styles.outsideMonth : '',
                      isSelected ? styles.selected : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-label={`${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`}
                    aria-pressed={isSelected}
                    onClick={() => {
                      onSelectDate(date)
                      setIsCalendarOpen(false)
                    }}
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
