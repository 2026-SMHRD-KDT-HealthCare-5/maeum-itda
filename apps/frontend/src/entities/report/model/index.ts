// GUARDIAN_REPORT_01 (UC-08/09) 기준.
// - emotionLevel: 결정사항 로그 §1 — 좋음/보통/나쁨 3단계 (문서상 높음/낮음 아님)
// - emotionScore가 null인 경우: 결정사항 로그 §1 — SGDS-K 응답 매핑 문항이
//   3개 미만이면 산출 보류 (UC-06-2 대안흐름). null 처리 시 화면 표기는 미정.
export type EmotionLevel = '좋음' | '보통' | '나쁨'

export interface EvidenceSentence {
  question: string
  answer: string
  isRiskEvidence: boolean
}

export interface DailyReport {
  date: string
  seniorId: string
  emotionScore: number | null
  emotionLevel: EmotionLevel | null
  // UC-06-4 (FR-03-06) 산출 — 유효 대화 없으면 생성 생략(대안흐름 A1) → null.
  conversationSummary: string | null
  recommendedAction: string | null
  evidenceSentences: EvidenceSentence[]
}
