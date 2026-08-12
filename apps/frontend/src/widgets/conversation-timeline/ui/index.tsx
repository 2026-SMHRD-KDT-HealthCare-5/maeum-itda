import { useState } from 'react'
import { ViewEvidenceSentenceAction } from '../../../features/view-evidence-sentence'
import type { EvidenceSentence } from '../../../entities/report'
import styles from './ConversationTimeline.module.css'

const mockEvidenceSentences: EvidenceSentence[] = [
  {
    question: '오늘 기분은 어떠세요?',
    answer: '조금 외롭네요. 가족들이 보고 싶어요.',
    isRiskEvidence: true,
    sentimentLabel: '부정',
    scaleLabel: '고립',
    questionCreatedAt: '2026-08-12T00:10:00.000Z',
    answerCreatedAt: '2026-08-12T00:11:00.000Z',
  },
  {
    question: '무릎은 괜찮으세요?',
    answer: '무릎이 조금 아파요. 오래 걷기는 힘들어요.',
    isRiskEvidence: true,
    sentimentLabel: '부정',
    scaleLabel: '우울',
    questionCreatedAt: '2026-08-12T00:14:00.000Z',
    answerCreatedAt: '2026-08-12T00:15:00.000Z',
  },
  {
    question: '점심은 맛있게 드셨나요?',
    answer: '네, 잘 먹었어요. 된장찌개가 맛있었어요.',
    isRiskEvidence: false,
    sentimentLabel: '보통',
    scaleLabel: '불안',
    questionCreatedAt: '2026-08-12T00:18:00.000Z',
    answerCreatedAt: '2026-08-12T00:19:00.000Z',
  },
]

// GUARDIAN_REPORT_01 (UC-09) — "정서 지수 산출 근거 (대화 내용)" 접이식
// 섹션. 목록 행 렌더링은 features/view-evidence-sentence에 위임한다.
export function ConversationTimeline() {
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
        (mockEvidenceSentences.length === 0 ? (
          <p className={styles.empty}>이날은 어르신과 나눈 대화가 없어요.</p>
        ) : (
          <ul id="conversation-timeline-list" className={styles.list}>
            {mockEvidenceSentences.map((sentence) => (
              <ViewEvidenceSentenceAction key={sentence.question} sentence={sentence} />
            ))}
          </ul>
        ))}
    </div>
  )
}
