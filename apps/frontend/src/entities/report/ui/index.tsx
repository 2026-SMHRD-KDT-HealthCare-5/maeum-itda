import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import emotionBadImage from '../../../shared/assets/character/character-daseul-emotion-bad.png'
import emotionGoodImage from '../../../shared/assets/character/character-daseul-emotion-good.png'
import emotionNormalImage from '../../../shared/assets/character/character-daseul-emotion-normal.png'
import emotionNoDataImage from '../../../shared/assets/character/character-daseul-no-data.png'
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

const meterClassName: Record<EmotionLevel | 'unknown', string> = {
  좋음: styles.meterGood,
  보통: styles.meterNormal,
  나쁨: styles.meterBad,
  unknown: styles.meterUnknown,
}

const emotionStateByLevel = {
  좋음: {
    comment: '오늘은 어르신께서 기분 좋은 하루를 보내셨어요.',
    image: emotionGoodImage,
    decoration: '♥',
  },
  보통: {
    comment: '오늘은 어르신의 컨디션이 평소와 비슷한 하루였어요.',
    image: emotionNormalImage,
    decoration: '🌿',
  },
  나쁨: {
    comment: '오늘은 어르신께서 다소 힘든 하루를 보내셨어요.',
    image: emotionBadImage,
    decoration: '💧',
  },
} satisfies Record<EmotionLevel, { comment: string; image: string; decoration: string }>

function getEmotionLevel(score: number): EmotionLevel {
  if (score < 50) return '나쁨'
  if (score < 70) return '보통'
  return '좋음'
}

// GUARDIAN_HOME_01 "오늘의 정서 지수" / GUARDIAN_REPORT_01 "이날의 정서 지수".
export function EmotionScoreCard({
  title,
  score,
  variant = 'default',
  detailsHref,
}: {
  title: string
  score: number | null
  level: EmotionLevel | null
  comment: string | null
  variant?: 'default' | 'dashboard'
  detailsHref?: string
}) {
  const resolvedLevel = score === null ? null : getEmotionLevel(score)
  const state = resolvedLevel ? emotionStateByLevel[resolvedLevel] : null
  const fixedComment = state?.comment ?? '데이터가 부족해 아직 산출하지 못했어요.'
  const characterImage = state?.image ?? emotionNoDataImage

  if (variant === 'dashboard') {
    const meterValue = Math.min(100, Math.max(0, score ?? 0))

    return (
      <div className={styles.dashboardScoreCard}>
        <div className={styles.dashboardScoreHeader}>
          <p className={styles.dashboardScoreTitle}>{title}</p>
          {detailsHref && (
            <Link className={styles.dashboardDetailsLink} to={detailsHref}>
              자세히 보기 <span aria-hidden="true">›</span>
            </Link>
          )}
        </div>
        <div className={styles.dashboardScoreContent}>
          <div className={styles.dashboardScoreCopy}>
            <div className={styles.dashboardScorePanel}>
              <p
                className={[styles.dashboardScore, levelClassName[resolvedLevel ?? 'unknown']].join(
                  ' ',
                )}
              >
                <strong>{score ?? '-'}</strong>
                <span>/ 100</span>
              </p>
              <div
                className={styles.scoreMeter}
                role="progressbar"
                aria-label={`${title} ${score ?? '데이터 없음'}점`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={score ?? undefined}
              >
                <span
                  className={meterClassName[resolvedLevel ?? 'unknown']}
                  style={{ width: `${meterValue}%` }}
                />
              </div>
            </div>
          </div>
          <div className={styles.dashboardScoreVisual}>
            <img className={styles.emotionCharacter} src={characterImage} alt="" />
            <span className={styles.emotionBadge} aria-hidden="true">
              {state?.decoration ?? '…'}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.scoreCard}>
      <span className={[styles.scoreCircle, levelClassName[resolvedLevel ?? 'unknown']].join(' ')}>
        {score ?? '-'}
      </span>
      <div className={styles.scoreContent}>
        <p className={styles.scoreTitle}>{title}</p>
        <p className={styles.scoreComment}>{fixedComment}</p>
      </div>
      <img className={styles.emotionCharacterSmall} src={characterImage} alt="" />
    </div>
  )
}

// "다슬이의 한마디" — UC-06-4와 별도 산출물인 recommendedAction을 보여준다.
// 2줄 넘는 긴 코멘트는 "더보기"로 펼친다(보호자 대시보드 state 목업 기준).
export function RecommendedActionCard({
  action,
  variant = 'default',
}: {
  action: string | null
  variant?: 'default' | 'dashboard'
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [hasOverflow, setHasOverflow] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const text = textRef.current
    if (!text) return

    const checkOverflow = () => {
      if (isExpanded) return
      setHasOverflow(text.scrollHeight > text.clientHeight + 1)
    }

    checkOverflow()
    const resizeObserver = new ResizeObserver(checkOverflow)
    resizeObserver.observe(text)

    return () => resizeObserver.disconnect()
  }, [action, isExpanded, variant])

  if (!action) return null

  return (
    <div
      className={[
        styles.actionCard,
        variant === 'dashboard' ? styles.dashboardActionCard : '',
        isExpanded ? styles.actionCardExpanded : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className={styles.actionIcon} aria-hidden="true">
        ✨
      </span>
      <div>
        <p className={styles.actionTitle}>다슬이의 한마디</p>
        <p
          ref={textRef}
          className={[
            styles.actionText,
            !isExpanded ? styles.collapsed : '',
            variant === 'dashboard' ? styles.dashboardActionText : '',
            hasOverflow && !isExpanded ? styles.actionTextWithToggle : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {action}
        </p>
        {(hasOverflow || isExpanded) && (
          <button
            type="button"
            className={styles.actionToggle}
            onClick={() => setIsExpanded((v) => !v)}
          >
            {isExpanded ? '접기 ▲' : '더보기 ▼'}
          </button>
        )}
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
