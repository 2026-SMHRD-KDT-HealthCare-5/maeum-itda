import type { EvidenceSentence, SentimentLabel } from '../../../entities/report'
import styles from './ViewEvidenceSentenceAction.module.css'

const sentimentClassName: Record<SentimentLabel, string> = {
  긍정: styles.sentimentPositive,
  보통: styles.sentimentNeutral,
  부정: styles.sentimentNegative,
}

// GUARDIAN_REPORT_01 (UC-09) — 근거 문장 한 건(질문/답변 + 감정 배지)을
// 렌더링한다. isRiskEvidence면 행 전체에 위험 강조를 준다. 목록 컨테이너와
// 접기/펼치기는 widgets/conversation-timeline이 소유한다.
export function ViewEvidenceSentenceAction({ sentence }: { sentence: EvidenceSentence }) {
  return (
    <li
      className={[styles.row, sentence.isRiskEvidence ? styles.risk : ''].filter(Boolean).join(' ')}
      aria-label={sentence.isRiskEvidence ? '위험 근거 문장' : undefined}
    >
      <p className={styles.qa}>
        <span className={styles.qLabel}>Q</span> {sentence.question}
      </p>
      <p className={styles.qa}>
        <span className={styles.aLabel}>A</span> {sentence.answer}
      </p>
      {sentence.sentimentLabel && (
        <span className={[styles.pill, sentimentClassName[sentence.sentimentLabel]].join(' ')}>
          {sentence.sentimentLabel}
        </span>
      )}
    </li>
  )
}
