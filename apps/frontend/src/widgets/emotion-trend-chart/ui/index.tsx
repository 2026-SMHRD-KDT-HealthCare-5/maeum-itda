import styles from './EmotionTrendChart.module.css'

interface DailyScorePoint {
  date: string
  emotionScore: number | null
}

const defaultMockScores: DailyScorePoint[] = [
  { date: '2025-06-01', emotionScore: 53 },
  { date: '2025-06-02', emotionScore: 82 },
  { date: '2025-06-03', emotionScore: null },
  { date: '2025-06-04', emotionScore: 41 },
  { date: '2025-06-05', emotionScore: 65 },
  { date: '2025-06-06', emotionScore: 52 },
  { date: '2025-06-07', emotionScore: 93 },
]

const CHART_WIDTH = 280
const CHART_HEIGHT = 140
const THRESHOLD_SCORE = 50

function scoreToY(score: number): number {
  return CHART_HEIGHT - (score / 100) * CHART_HEIGHT
}

function pointX(index: number, count: number): number {
  if (count <= 1) return 0
  return (index / (count - 1)) * CHART_WIDTH
}

// GUARDIAN_HOME_01 / 보호자 주간 리포트 (UC-08) 공유 — 최근 7일 정서지수
// 선그래프. 외부 차트 라이브러리 없이 인라인 SVG로 그린다. dailyScores를
// 넘기지 않으면 단독 렌더링(guardian-home)을 위한 기본 mock을 쓴다.
export function EmotionTrendChart({
  dailyScores = defaultMockScores,
}: {
  dailyScores?: DailyScorePoint[]
}) {
  const count = dailyScores.length
  const points = dailyScores.map((day, index) =>
    day.emotionScore === null ? null : { x: pointX(index, count), y: scoreToY(day.emotionScore) },
  )

  const segments: Array<Array<{ x: number; y: number }>> = []
  let current: Array<{ x: number; y: number }> = []
  for (const point of points) {
    if (point) {
      current.push(point)
    } else if (current.length > 0) {
      segments.push(current)
      current = []
    }
  }
  if (current.length > 0) segments.push(current)

  const lastPointIndex = points.reduce((last, point, index) => (point ? index : last), -1)

  return (
    <div className={styles.chart}>
      <h2 className={styles.title}>최근 7일 정서 지수</h2>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label="최근 7일 정서 지수 추이"
      >
        {[0, 25, 50, 75, 100].map((tick) => (
          <line
            key={tick}
            className={styles.gridLine}
            x1={0}
            x2={CHART_WIDTH}
            y1={scoreToY(tick)}
            y2={scoreToY(tick)}
          />
        ))}
        <line
          className={styles.thresholdLine}
          x1={0}
          x2={CHART_WIDTH}
          y1={scoreToY(THRESHOLD_SCORE)}
          y2={scoreToY(THRESHOLD_SCORE)}
        />
        {segments.map((segment, index) => (
          <polyline
            key={index}
            className={styles.line}
            points={segment.map((point) => `${point.x},${point.y}`).join(' ')}
          />
        ))}
        {points.map(
          (point, index) =>
            point && (
              <circle
                key={index}
                className={index === lastPointIndex ? styles.pointLast : styles.point}
                cx={point.x}
                cy={point.y}
                r={index === lastPointIndex ? 5 : 4}
              />
            ),
        )}
      </svg>
      <div className={styles.labels}>
        {dailyScores.map((day, index) => (
          <span key={day.date} className={styles.dayLabel}>
            {index === dailyScores.length - 1 ? '오늘' : day.date.slice(5).replace('-', '/')}
          </span>
        ))}
      </div>
    </div>
  )
}
