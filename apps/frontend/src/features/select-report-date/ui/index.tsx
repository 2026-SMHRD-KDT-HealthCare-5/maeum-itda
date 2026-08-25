import { useRef, useState } from 'react'
import {
  getCalendarDates,
  isSameDate,
  toDateKey,
  useAnimatedPresence,
  useFocusTrap,
} from '../../../shared/lib'
import { formatKoreanDate } from '../lib'
import styles from './SelectReportDateAction.module.css'

const weekDays = ['일', '월', '화', '수', '목', '금', '토']

interface SelectReportDateActionProps {
  selectedDate: Date
  onSelectDate: (date: Date) => void
  reportStatusByDate: Map<string, 'WAITING' | 'COMPLETED' | 'FAILED'>
  // 모달에서 보고 있는 달이 바뀔 때마다 알려준다 — 부모가 이 달 기준으로
  // datesWithReport를 새로 가져오지 않으면, 선택된 날짜의 달과 다른 달로
  // 넘겼을 때 그 달의 "리포트 있음" 점이 안 찍힌 채로 남는다.
  onVisibleMonthChange?: (month: Date) => void
}

// GUARDIAN_REPORT_01 (UC-08) — 일간 리포트 날짜 네비게이션 + 캘린더 모달.
// features/select-daily-record-date와 같은 패턴이지만(날짜 계산은 이제
// shared/lib 공유), 보호자 리포트는 대화-기록-있음 표시가 필요 없어 그
// 하이라이트 로직만 뺐다.
export function SelectReportDateAction({
  selectedDate,
  onSelectDate,
  reportStatusByDate,
  onVisibleMonthChange,
}: SelectReportDateActionProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const calendarPresence = useAnimatedPresence(isCalendarOpen)
  const modalRef = useRef<HTMLDivElement>(null)
  useFocusTrap(modalRef, calendarPresence.isRendered, () => setIsCalendarOpen(false))
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  )

  function moveDay(offset: number) {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + offset)
    onSelectDate(next)
  }

  function moveMonth(offset: number) {
    setVisibleMonth((current) => {
      const next = new Date(current.getFullYear(), current.getMonth() + offset, 1)
      onVisibleMonthChange?.(next)
      return next
    })
  }

  function openCalendar() {
    const month = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
    setVisibleMonth(month)
    onVisibleMonthChange?.(month)
    setIsCalendarOpen(true)
  }

  const year = visibleMonth.getFullYear()
  const month = visibleMonth.getMonth()
  const calendarDates = getCalendarDates(year, month)

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

      {calendarPresence.isRendered && (
        <div
          className={`${styles.modalOverlay} ${calendarPresence.isClosing ? styles.modalOverlayClosing : ''}`}
          onClick={() => setIsCalendarOpen(false)}
        >
          <div
            ref={modalRef}
            className={`${styles.modal} ${calendarPresence.isClosing ? styles.modalClosing : ''}`}
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
                const reportStatus = reportStatusByDate.get(toDateKey(date))
                const hasCompletedReport = reportStatus === 'COMPLETED'
                const hasIncompleteReport = reportStatus === 'WAITING' || reportStatus === 'FAILED'
                const isSelected = isSameDate(date, selectedDate)
                const isOutsideMonth = date.getMonth() !== month

                return (
                  <button
                    type="button"
                    key={toDateKey(date)}
                    className={[
                      styles.dateCell,
                      isOutsideMonth ? styles.outsideMonth : '',
                      hasCompletedReport ? styles.hasCompletedReport : '',
                      hasIncompleteReport ? styles.hasIncompleteReport : '',
                      isSelected ? styles.selected : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-label={`${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일, ${
                      hasCompletedReport
                        ? '분석 완료'
                        : hasIncompleteReport
                          ? '대화 기록 있음, 분석 미완료'
                          : '리포트 없음'
                    }`}
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
              <span className={styles.completedLegend}>● 분석 완료</span>
              <span className={styles.incompleteLegend}>● 대화 기록만 있음</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
