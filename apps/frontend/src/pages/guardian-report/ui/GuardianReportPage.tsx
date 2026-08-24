import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SelectReportDateAction, toDateKey } from '../../../features/select-report-date'
import {
  ConversationSummaryCard,
  EmotionScoreCard,
  RecommendedActionCard,
  fetchDailyReport,
  fetchReportCalendar,
  type DailyReport,
} from '../../../entities/report'
import { extractApiErrorMessage, isNotFoundError } from '../../../shared/api'
import { useDelayedPending } from '../../../shared/lib'
import { Button, Card, Skeleton } from '../../../shared/ui'
import daseulGuideImage from '../../../shared/assets/character/character-daseul-guide.webp'
import daseulNoDataImage from '../../../shared/assets/character/character-daseul-no-data.webp'
import { ConversationTimeline } from '../../../widgets/conversation-timeline'
import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import { ReportPeriodTabs } from '../../../widgets/report-period-tabs'
import styles from './GuardianReportPage.module.css'

// GUARDIAN_REPORT_01 (UC-08, UC-09) — 결정사항 로그 §7에서 일간/주간 탭
// 위젯과 "이날의 정서 지수"/"다슬이의 한마디"/"이날의 대화 요약" 카드를
// 추가했다. GET /reports/daily, /reports/calendar 실연동.
export function GuardianReportPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedDate = searchParams.get('date')
  const [selectedDate, setSelectedDate] = useState(() =>
    requestedDate ? new Date(`${requestedDate}T00:00:00`) : new Date(),
  )
  const dateKey = toDateKey(selectedDate)

  // 캘린더 모달에서 실제로 보고 있는 달 — selectedDate와 별개다. 모달 안에서
  // 다른 달로 넘겨도 이 값이 갱신되어야 그 달의 리포트 보유 여부를 가져온다.
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  )
  const calendarQuery = useQuery({
    queryKey: ['report-calendar', calendarMonth.getFullYear(), calendarMonth.getMonth()],
    queryFn: () => fetchReportCalendar(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1),
  })
  const dailyReportQuery = useQuery({
    queryKey: ['daily-report', dateKey],
    queryFn: () => fetchDailyReport(dateKey),
    retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 2,
  })

  // react-query의 placeholderData(keepPreviousData)는 "이전 성공 데이터"만 이어줄 뿐,
  // "이전 날짜도 리포트가 없었다(404)"는 상태는 안 이어준다 — 그래서 데이터 없는
  // 날짜에서 데이터 없는 날짜로 넘어갈 때도 fetch 도중엔 화면이 완전히 비었다가
  // 다시 "리포트 없음" 문구로 돌아오는, 앞뒤가 똑같은데도 깜빡이는 현상이 있었다.
  // 성공/404 둘 다 "확정된 결과"로 직접 기억해뒀다가, 새 날짜 fetch가 끝나기
  // 전까지는 이 값을 그대로 보여준다. useEffect 대신 렌더 중 state 조정
  // 패턴(react.dev 권장)을 쓴다 — resolvedDateKey가 dateKey와 달라졌을 때만
  // 갱신해 무한 렌더를 막는다.
  const [resolvedDateKey, setResolvedDateKey] = useState<string | null>(null)
  // 선택한 날짜의 성공/빈 결과가 아직 확정되지 않았을 때만 로딩을 표시한다.
  // 이미 캐시된 현재 날짜를 재검증할 때는 기존 리포트를 그대로 유지한다.
  const showSpinner = useDelayedPending(dailyReportQuery.isFetching && resolvedDateKey !== dateKey)
  const [resolvedView, setResolvedView] = useState<
    { kind: 'found'; report: DailyReport } | { kind: 'missing' } | null
  >(null)
  const queryReportMissing = dailyReportQuery.isError && isNotFoundError(dailyReportQuery.error)

  if (resolvedDateKey !== dateKey && dailyReportQuery.isSuccess) {
    setResolvedDateKey(dateKey)
    setResolvedView({ kind: 'found', report: dailyReportQuery.data })
  } else if (resolvedDateKey !== dateKey && queryReportMissing) {
    setResolvedDateKey(dateKey)
    setResolvedView({ kind: 'missing' })
  }

  const report =
    resolvedDateKey === dateKey && resolvedView?.kind === 'found' ? resolvedView.report : null
  const reportMissing = resolvedDateKey === dateKey && resolvedView?.kind === 'missing'
  const hasAnalysis = Boolean(
    report &&
    (report.emotionScore !== null ||
      report.conversationSummary ||
      report.recommendedAction ||
      report.evidenceSentences.length > 0),
  )

  function selectDate(date: Date) {
    setSelectedDate(date)
    setSearchParams({ date: toDateKey(date) }, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <main className={styles.page}>
        <ReportPeriodTabs active="daily" weekStart={dateKey} />

        <SelectReportDateAction
          selectedDate={selectedDate}
          onSelectDate={selectDate}
          reportStatusByDate={calendarQuery.data?.dailyReportStatusByDate ?? new Map()}
          onVisibleMonthChange={setCalendarMonth}
        />

        {showSpinner && (
          <div className={styles.loadingState} role="status" aria-live="polite">
            <span className={styles.loadingLabel}>리포트를 불러오고 있어요</span>
            <Skeleton className={styles.scoreSkeleton} />
            <Skeleton className={styles.evidenceSkeleton} />
            <Skeleton className={styles.contentSkeleton} />
          </div>
        )}

        {dailyReportQuery.isError && !reportMissing && (
          <div className={styles.statusMessage} role="alert">
            <p>{extractApiErrorMessage(dailyReportQuery.error, '리포트를 불러오지 못했어요.')}</p>
            <Button type="button" onClick={() => dailyReportQuery.refetch()}>
              다시 시도
            </Button>
          </div>
        )}

        {report && hasAnalysis && (
          <>
            {report.emotionScore !== null && (
              <Card className={styles.scoreCard} key={`score-${dateKey}`}>
                <EmotionScoreCard
                  title="이날의 정서 지수"
                  score={report.emotionScore}
                  level={report.emotionLevel}
                  comment={report.conversationSummary}
                  variant="dashboard"
                />
              </Card>
            )}

            {report.evidenceSentences.length > 0 && (
              <ConversationTimeline
                key={`evidence-${dateKey}`}
                evidences={report.evidenceSentences}
              />
            )}

            {report.conversationSummary && (
              <section
                className={styles.summarySection}
                aria-label="이날의 대화 요약"
                key={`summary-${dateKey}`}
              >
                <Card className={styles.summaryCard}>
                  <ConversationSummaryCard summary={report.conversationSummary} />
                </Card>
              </section>
            )}

            {report.recommendedAction && (
              <section
                className={styles.recommendationSection}
                aria-label="다슬이의 한마디"
                key={`recommendation-${dateKey}`}
              >
                <img className={styles.recommendationCharacter} src={daseulGuideImage} alt="" />
                <Card className={styles.recommendationCard}>
                  <RecommendedActionCard action={report.recommendedAction} variant="report" />
                </Card>
              </section>
            )}
          </>
        )}

        {report && !hasAnalysis && (
          <section
            className={styles.emptyState}
            aria-labelledby="analysis-empty-title"
            key={`analysis-empty-${dateKey}`}
          >
            <img
              className={styles.emptyCharacter}
              src={daseulNoDataImage}
              alt="분석 결과를 기다리는 다슬"
            />
            <h2 id="analysis-empty-title" className={styles.emptyTitle}>
              분석 결과가 생성되지 않았어요
            </h2>
            <p className={styles.emptyHint}>
              대화 기록은 안전하게 저장됐어요. 분석할 답변이 충분하지 않았거나 처리 중 문제가 있었을
              수 있어요.
            </p>
            <Button
              type="button"
              className={styles.analysisRetryButton}
              onClick={() => dailyReportQuery.refetch()}
              disabled={dailyReportQuery.isFetching}
            >
              {dailyReportQuery.isFetching ? '확인 중…' : '분석 결과 다시 확인'}
            </Button>
          </section>
        )}

        {reportMissing && (
          <section
            className={styles.emptyState}
            aria-labelledby="guardian-report-empty-title"
            key={`report-empty-${dateKey}`}
          >
            <img
              className={styles.emptyCharacter}
              src={daseulNoDataImage}
              alt="리포트 기록이 없어 아쉬워하는 다슬"
            />
            <h2 id="guardian-report-empty-title" className={styles.emptyTitle}>
              이날은 확인할 수 있는 리포트가 없어요
            </h2>
            <p className={styles.emptyHint}>
              대화가 진행된 다른 날짜를 선택하면 어르신의 정서 지수와 대화 요약을 확인할 수 있어요.
            </p>
          </section>
        )}
      </main>
      <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
    </>
  )
}
