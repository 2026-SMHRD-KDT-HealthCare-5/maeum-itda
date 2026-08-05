// GUARDIAN_REPORT_01 (UC-08/09) 기준.
// - emotionLevel: 결정사항 로그 §1 — 좋음/보통/나쁨 3단계 (문서상 높음/낮음 아님)
// - emotionScore가 null인 경우: 결정사항 로그 §1 — SGDS-K 응답 매핑 문항이
//   3개 미만이면 산출 보류 (UC-06-2 대안흐름). null 처리 시 화면 표기는 미정.
// - emotionScore는 결정사항 로그 §2-5에 따라 TextScore 단일값이다 — 문서의
//   "TextScore×0.7 + VoiceScore×0.3" 공식은 폐기됐으니 그대로 구현하지 말 것.
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

// 화면ID 미배정(신규, 결정사항 로그 §5) — 보호자 주간 리포트 상세 화면 초안.
// weekStart의 정확한 의미(월요일/일요일 기준, 서비스 기준 시간대)는 아직
// 기획 결정 전이라 미정으로 남겨둔다 — 확정 전까지 이 타입을 실제 API
// 응답으로 취급하지 말 것.
export interface WeeklyReport {
  weekStart: string // 미정: 주 시작 요일·시간대 확정 필요
  seniorId: string
  dailyScores: Array<{ date: string; emotionScore: number | null; emotionLevel: EmotionLevel | null }>
  averageScore: number | null
  recommendedAction: string | null
}
