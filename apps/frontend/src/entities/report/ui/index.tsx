import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { EmotionLevel } from '../model'
import styles from './ReportCards.module.css'

// TODO(entities/report): fetch가 필요한 실제 화면 조합은 pages/*가 담당한다.
// 여기 컴포넌트들은 순수 표시용(props in, render out)이라 mock 데이터 여부와
// 무관하게 그대로 재사용된다.

const levelClassName: Record<EmotionLevel | 'unknown', string> = {
  좋음: styles.levelGood,
  보통: styles.levelNormal,
  나쁨: styles.levelBad,
  unknown: styles.levelUnknown,
}

// GUARDIAN_HOME_01 "오늘의 정서 지수" / GUARDIAN_REPORT_01 "이날의 정서 지수".
export function EmotionScoreCard({
  title,
  score,
  level,
  comment,
}: {
  title: string
  score: number | null
  level: EmotionLevel | null
  comment: string | null
}) {
  return (
    <div className={styles.scoreCard}>
      <span className={[styles.scoreCircle, levelClassName[level ?? 'unknown']].join(' ')}>
        {score ?? '-'}
      </span>
      <div>
        <p className={styles.scoreTitle}>{title}</p>
        <p className={styles.scoreComment}>
          {comment ?? '데이터가 부족해 아직 산출하지 못했어요.'}
        </p>
      </div>
    </div>
  )
}

// "다솔이의 한마디" — UC-06-4와 별도 산출물인 recommendedAction을 보여준다.
// 2줄 넘는 긴 코멘트는 "더보기"로 펼친다(보호자 대시보드 state 목업 기준).
export function RecommendedActionCard({ action }: { action: string | null }) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!action) return null

  return (
    <div className={styles.actionCard}>
      <span className={styles.actionIcon} aria-hidden="true">
        🐾
      </span>
      <div>
        <p className={styles.actionTitle}>다솔이의 한마디</p>
        <p
          className={[styles.actionText, isExpanded ? '' : styles.collapsed]
            .filter(Boolean)
            .join(' ')}
        >
          {action}
        </p>
        <button
          type="button"
          className={styles.actionToggle}
          onClick={() => setIsExpanded((v) => !v)}
        >
          {isExpanded ? '접기' : '더보기'}
        </button>
      </div>
    </div>
  )
}

// GUARDIAN_REPORT_01 "이날의 대화 요약" — UC-06-4 보호자용 일간 요약.
export function ConversationSummaryCard({ summary }: { summary: string | null }) {
  if (!summary) return null

  return (
    <div>
      <p className={styles.summaryTitle}>이날의 대화 요약</p>
      <p className={styles.summaryText}>{summary}</p>
    </div>
  )
}

// 보호자 주간 리포트 조회 화면의 평균/최고/최저 통계 카드.
export function WeeklyStatsCards({
  averageScore,
  maxScore,
  minScore,
}: {
  averageScore: number | null
  maxScore: number | null
  minScore: number | null
}) {
  return (
    <div className={styles.statsRow}>
      <div className={styles.statCard}>
        <span className={styles.statLabel}>평균</span>
        <span className={styles.statValue}>{averageScore ?? '-'}</span>
      </div>
      <div className={styles.statCard}>
        <span className={styles.statLabel}>최고</span>
        <span className={styles.statValue}>{maxScore ?? '-'}</span>
      </div>
      <div className={styles.statCard}>
        <span className={styles.statLabel}>최저</span>
        <span className={styles.statValue}>{minScore ?? '-'}</span>
      </div>
    </div>
  )
}

interface WeeklyDailySummaryListProps {
  dailyScores: Array<{
    date: string
    emotionScore: number | null
    emotionLevel: EmotionLevel | null
    comment: string | null
  }>
}

// 주간 리포트의 "일별 요약" — 카드를 탭하면 해당 날짜의 일간 리포트로 이동.
export function WeeklyDailySummaryList({ dailyScores }: WeeklyDailySummaryListProps) {
  return (
    <div>
      <div className={styles.dailyList}>
        {dailyScores.map((day) => (
          <Link className={styles.dailyRow} to="/guardian/report" key={day.date}>
            <span className={styles.dailyDate}>{day.date.slice(5).replace('-', '/')}</span>
            <span className={styles.dailyScore}>{day.emotionScore ?? '-'}</span>
            <span className={styles.dailyComment}>{day.comment ?? '데이터 부족'}</span>
          </Link>
        ))}
      </div>
      <p className={styles.dailyHint}>카드를 탭하면 일간 리포트로 이동해요</p>
    </div>
  )
}
