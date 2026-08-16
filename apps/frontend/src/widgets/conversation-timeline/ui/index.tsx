import { useState } from 'react'
import { ViewEvidenceSentenceAction } from '../../../features/view-evidence-sentence'
import type { EvidenceSentence } from '../../../entities/report'
import styles from './ConversationTimeline.module.css'

// GUARDIAN_REPORT_01 (UC-09) — "정서 지수 산출 근거 (대화 내용)" 접이식
// 섹션. 목록 행 렌더링은 features/view-evidence-sentence에 위임한다.
export function ConversationTimeline({ evidences }: { evidences: EvidenceSentence[] }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className={styles.section}>
      <button
        type="button"
        className={styles.header}
        aria-expanded={isExpanded}
        aria-controls="conversation-timeline-list"
        onClick={() => setIsExpanded((current) => !current)}
      >
        정서 지수 산출 근거 (대화 내용)
        <svg
          className={[styles.chevron, isExpanded ? styles.chevronOpen : ''].join(' ')}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isExpanded &&
        (evidences.length === 0 ? (
          <p className={styles.empty}>이날은 어르신과 나눈 대화가 없어요.</p>
        ) : (
          <ul id="conversation-timeline-list" className={styles.list}>
            {evidences.map((sentence) => (
              <ViewEvidenceSentenceAction key={sentence.messageId} sentence={sentence} />
            ))}
          </ul>
        ))}
    </div>
  )
}
