// GUARDIAN_REPORT_01 (UC-08/09) 기준.
// - emotionLevel: 결정사항 로그 §1 — 좋음/보통/나쁨 3단계 (문서상 높음/낮음 아님)
// - emotionScore가 null인 경우: 결정사항 로그 §1 — SGDS-K 응답 매핑 문항이
//   3개 미만이면 산출 보류 (UC-06-2 대안흐름). null 처리 시 화면 표기는 미정.
// - emotionScore는 결정사항 로그 §2-5에 따라 TextScore 단일값이다 — 문서의
//   "TextScore×0.7 + VoiceScore×0.3" 공식은 폐기됐으니 그대로 구현하지 말 것.
export type EmotionLevel = '좋음' | '보통' | '나쁨'

// sentimentLabel: 결정사항 로그 §2-4/§7 — 척도 태그가 없어도 실시간 감성분석
// 결과(sentiment_label)가 있으면 그 라벨과 함께 노출해야 하므로 추가된 필드.
// isRiskEvidence와는 독립적이다(위험 근거이면서 라벨이 없을 수도, 위험 근거가
// 아니면서 라벨만 있을 수도 있음).
export type SentimentLabel = '긍정' | '보통' | '부정'
export type EvidenceScale = '우울' | '불안' | '고립'

export interface EvidenceSentence {
  messageId: number
  // 답변 앞에 질문이 없을 수 있어(첫 turn 등) nullable이다 — 백엔드 계약과 동일.
  question: string | null
  answer: string
  isRiskEvidence: boolean
  sentimentLabel: SentimentLabel | null
  scaleLabel?: EvidenceScale | null
  questionCreatedAt?: string | null
  answerCreatedAt?: string | null
}

// entities/report/ui의 EmotionScoreCard와 GET /reports/daily 응답 매핑(entities/report/api)이
// 공유하는 점수->3단계 구간 규칙 — 백엔드가 emotionLevel을 안 주는 API(일간 리포트 등)에서도
// 화면과 동일한 기준으로 판정하려면 이 한 곳만 바꾸면 되게 한다.
export function getEmotionLevel(score: number): EmotionLevel {
  if (score < 50) return '나쁨'
  if (score < 70) return '보통'
  return '좋음'
}

const EMOTION_LEVEL_FROM_API: Record<'BAD' | 'NORMAL' | 'GOOD', EmotionLevel> = {
  BAD: '나쁨',
  NORMAL: '보통',
  GOOD: '좋음',
}

// 백엔드 EmotionLevel enum(BAD/NORMAL/GOOD)을 화면 표기(나쁨/보통/좋음)로 맞춘다.
export function emotionLevelFromApi(
  level: 'BAD' | 'NORMAL' | 'GOOD' | null | undefined,
): EmotionLevel | null {
  return level ? EMOTION_LEVEL_FROM_API[level] : null
}

// GUARDIAN_HOME_01 — GET /guardian/dashboard 통합 조회 결과.
export interface GuardianDashboard {
  guardianName: string
  seniorName: string
  seniorConnectedAt: string
  daysTogether: number
  dasolMessage: string
  latestDailyReport: {
    emotionScore: number | null
    emotionLevel: EmotionLevel | null
    conversationSummary: string | null
    recommendedAction: string | null
  }
  recentSevenDays: Array<{ date: string; emotionScore: number | null }>
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
  dailyScores: Array<{
    date: string
    emotionScore: number | null
    emotionLevel: EmotionLevel | null
    // 결정사항 로그 §7 — Figma '보호자 주간 리포트 조회' 화면의 "일별 요약"
    // 카드(요일별 짧은 코멘트)를 채우기 위해 추가. 데이터 부족일은 null.
    comment: string | null
  }>
  averageScore: number | null
  // maxScore/minScore: 결정사항 로그 §7 — 주간 리포트 화면의 통계 카드(평균/
  // 최고/최저)를 채우기 위해 추가. '데이터 부족' 날짜는 평균과 동일하게
  // 산정에서 제외한다(§1 척도 데이터 부족 시 처리 규칙과 동일한 원칙).
  maxScore: number | null
  minScore: number | null
  recommendedAction: string | null
}
