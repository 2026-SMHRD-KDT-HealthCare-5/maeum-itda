import { useEffect, useState } from 'react'
import { useAnimatedPresence } from '../../../shared/lib'
import { formatKoreanDate, getCalendarDates, isSameDate, toDateKey } from '../model'
import styles from './SelectDailyRecordDateAction.module.css'

const weekDays = ['일', '월', '화', '수', '목', '금', '토']

interface SelectDailyRecordDateActionProps {
  selectedDate: Date
  onSelectDate: (date: Date) => void
  datesWithConversation: Set<string>
}

// UC-14 — 시니어 이전 대화 기록 조회 화면 상단 날짜 네비게이션 + 캘린더 모달.
export function SelectDailyRecordDateAction({
  selectedDate,
  onSelectDate,
  datesWithConversation,
}: SelectDailyRecordDateActionProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const calendarPresence = useAnimatedPresence(isCalendarOpen)
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
          aria-label="전날 보기"
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
          aria-label="다음날 보기"
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
            aria-label="날짜 선택"
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
                const hasConversation = datesWithConversation.has(toDateKey(date))
                const isSelected = isSameDate(date, selectedDate)
                const isOutsideMonth = date.getMonth() !== month

                return (
                  <button
                    type="button"
                    key={toDateKey(date)}
                    className={[
                      styles.dateCell,
                      isOutsideMonth ? styles.outsideMonth : '',
                      date.getDay() === 0 ? styles.sunday : '',
                      date.getDay() === 6 ? styles.saturday : '',
                      hasConversation ? styles.hasConversation : '',
                      isSelected ? styles.selected : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-label={`${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일${hasConversation ? ', 대화 기록 있음' : ', 대화 기록 없음'}`}
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

            <div className={styles.legend}>
              <span className={styles.conversationLegend}>● 대화 기록 있음</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
