import type { EvidenceSentence, SentimentLabel } from '../../../entities/report'
import styles from './ViewEvidenceSentenceAction.module.css'

const sentimentClassName: Record<SentimentLabel, string> = {
  긍정: styles.sentimentPositive,
  보통: styles.sentimentNeutral,
  부정: styles.sentimentNegative,
}

const sentimentRowClassName: Record<SentimentLabel, string> = {
  긍정: styles.rowPositive,
  보통: styles.rowNeutral,
  부정: styles.rowNegative,
}

const messageTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Asia/Seoul',
})

function formatMessageTime(timestamp?: string | null) {
  if (!timestamp) return null
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? null : messageTimeFormatter.format(date)
}

// GUARDIAN_REPORT_01 (UC-09) — 근거 문장 한 건(질문/답변 + 감정 배지)을
// 렌더링한다. isRiskEvidence면 행 전체에 위험 강조를 준다. 목록 컨테이너와
// 접기/펼치기는 widgets/conversation-timeline이 소유한다.
export function ViewEvidenceSentenceAction({ sentence }: { sentence: EvidenceSentence }) {
  const questionTime = formatMessageTime(sentence.questionCreatedAt)
  const answerTime = formatMessageTime(sentence.answerCreatedAt)

  return (
    <li
      className={[
        styles.row,
        sentence.sentimentLabel ? sentimentRowClassName[sentence.sentimentLabel] : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={sentence.isRiskEvidence ? '위험 근거 문장' : undefined}
    >
      <div className={styles.badges}>
        {sentence.scaleLabel && <span className={styles.scalePill}>{sentence.scaleLabel}</span>}
        {sentence.sentimentLabel && (
          <span className={[styles.pill, sentimentClassName[sentence.sentimentLabel]].join(' ')}>
            {sentence.sentimentLabel}
          </span>
        )}
      </div>
      {sentence.question && (
        <div className={styles.messageBlock}>
          <p className={styles.qa}>
            <span className={styles.qLabel}>Q</span> {sentence.question}
          </p>
          {questionTime && (
            <time dateTime={sentence.questionCreatedAt ?? undefined}>{questionTime}</time>
          )}
        </div>
      )}
      <div className={[styles.messageBlock, styles.answerBlock].join(' ')}>
        <p className={styles.qa}>
          {sentence.answer} <span className={styles.aLabel}>A</span>
        </p>
        {answerTime && <time dateTime={sentence.answerCreatedAt ?? undefined}>{answerTime}</time>}
      </div>
    </li>
  )
}
