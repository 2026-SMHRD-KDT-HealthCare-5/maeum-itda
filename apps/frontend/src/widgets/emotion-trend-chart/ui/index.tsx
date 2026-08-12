import type { KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import styles from './EmotionTrendChart.module.css'

interface DailyScorePoint {
  date: string
  emotionScore: number | null
}

interface ScoreDotProps {
  cx?: number
  cy?: number
  index?: number
  payload?: DailyScorePoint
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

const THRESHOLD_SCORE = 50

function formatDateLabel(date: string): string {
  const [, month, day] = date.split('-')
  return `${Number(month)}/${Number(day)}`
}

function ScoreDot({
  cx,
  cy,
  index,
  payload,
  lastDataIndex,
  onSelectDate,
}: ScoreDotProps & { lastDataIndex: number; onSelectDate: (date: string) => void }) {
  if (cx === undefined || cy === undefined || index === undefined || !payload) return null

  const isLast = index === lastDataIndex

  function handleKeyDown(event: KeyboardEvent<SVGGElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onSelectDate(payload!.date)
  }

  return (
    <g
      className={styles.clickablePoint}
      role="link"
      tabIndex={0}
      aria-label={`${formatDateLabel(payload.date)} 일간 리포트 보기`}
      onClick={() => onSelectDate(payload.date)}
      onKeyDown={handleKeyDown}
    >
      {isLast && <circle className={styles.pointHalo} cx={cx} cy={cy} r={10} />}
      <circle
        className={isLast ? styles.pointLast : styles.point}
        cx={cx}
        cy={cy}
        r={isLast ? 5.5 : 4.5}
      />
    </g>
  )
}

// GUARDIAN_HOME_01 / 보호자 주간 리포트 (UC-08) 공유 — 최근 7일 정서지수.
// null 점수 날짜는 배경 밴드로 표시하고, 유효 점수끼리는 선을 이어 추이를 보여준다.
export function EmotionTrendChart({
  dailyScores = defaultMockScores,
  highlightToday = true,
  detailsHref,
}: {
  dailyScores?: DailyScorePoint[]
  highlightToday?: boolean
  detailsHref?: string
}) {
  const navigate = useNavigate()
  const chartData = dailyScores.map((day, index) => ({
    ...day,
    label: highlightToday && index === dailyScores.length - 1 ? '오늘' : formatDateLabel(day.date),
  }))
  const lastDataIndex = dailyScores.reduce(
    (last, day, index) => (day.emotionScore === null ? last : index),
    -1,
  )

  return (
    <section className={styles.chart}>
      <div className={styles.header}>
        <h2 className={styles.title}>최근 7일 정서 지수</h2>
        {detailsHref && (
          <Link className={styles.detailsLink} to={detailsHref}>
            지난 기록 보기 <span aria-hidden="true">›</span>
          </Link>
        )}
      </div>

      <div
        className={styles.chartCanvas}
        role="img"
        aria-label="최근 7일 정서 지수 추이. 데이터가 없는 날짜는 회색 배경으로 표시됩니다."
      >
        <div
          className={styles.missingBands}
          style={{ gridTemplateColumns: `repeat(${Math.max(chartData.length, 1)}, 1fr)` }}
          aria-hidden="true"
        >
          {chartData.map((day) => (
            <span className={day.emotionScore === null ? styles.missingBand : ''} key={day.date} />
          ))}
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 12, bottom: 2, left: 6 }}>
            <defs>
              <filter id="emotion-line-shadow" x="-20%" y="-30%" width="140%" height="160%">
                <feDropShadow
                  dx="0"
                  dy="2"
                  floodColor="#40556b"
                  floodOpacity="0.14"
                  stdDeviation="1.5"
                />
              </filter>
            </defs>
            <ReferenceArea fill="#fdecec" fillOpacity={0.62} ifOverflow="hidden" y1={0} y2={49} />
            <ReferenceArea fill="#fff5dc" fillOpacity={0.62} ifOverflow="hidden" y1={50} y2={69} />
            <ReferenceArea fill="#edf7f1" fillOpacity={0.72} ifOverflow="hidden" y1={70} y2={100} />
            <CartesianGrid className={styles.grid} vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="label"
              tick={{ fill: '#8a918a', fontSize: 11 }}
              tickLine={false}
            />
            <YAxis
              axisLine={false}
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fill: '#bcc2bd', fontSize: 10 }}
              tickLine={false}
              width={32}
            />
            <Tooltip
              cursor={{ stroke: '#d8ddd9', strokeDasharray: '3 3' }}
              formatter={(value) => [`${value}점`, '정서 지수']}
              labelFormatter={(_, payload) => payload[0]?.payload.date ?? ''}
              contentStyle={{
                border: '1px solid #e5e4e7',
                borderRadius: 12,
                boxShadow: '0 6px 18px rgba(43, 58, 51, 0.1)',
                fontSize: 12,
              }}
            />
            <ReferenceLine
              label={{
                value: '주의 기준',
                position: 'insideTopRight',
                fill: '#c86b63',
                fontSize: 10,
              }}
              y={THRESHOLD_SCORE}
              stroke="#d95a4e"
              strokeDasharray="5 5"
              strokeWidth={1.25}
            />
            <Line
              connectNulls
              dataKey="emotionScore"
              dot={
                <ScoreDot
                  lastDataIndex={lastDataIndex}
                  onSelectDate={(date) => navigate(`/guardian/report?date=${date}`)}
                />
              }
              isAnimationActive={false}
              style={{ filter: 'url(#emotion-line-shadow)' }}
              stroke="#40556b"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3.25}
              type="monotoneX"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
