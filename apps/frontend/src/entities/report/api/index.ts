import type {
  DailyReportEvidenceResponseDto,
  DailyReportResponseDto,
  GuardianDashboardResponseDto,
  WeeklyReportResponseDto,
} from '@maeum-itda/api-client'
import { apiClient } from '../../../shared/api'
import {
  emotionLevelFromApi,
  getEmotionLevel,
  type DailyReport,
  type EvidenceSentence,
  type GuardianDashboard,
  type WeeklyReport,
} from '../model'

// DailyReportEvidenceResponseDto의 sentimentLabel/scaleLabel은 백엔드에서 이미
// 화면과 같은 한국어 문자열(긍정/보통/부정, 우울/불안/고립)로 내려주므로 값
// 매핑 없이 타입만 좁힌다.
function toEvidenceSentence(dto: DailyReportEvidenceResponseDto): EvidenceSentence {
  return {
    messageId: dto.messageId,
    question: dto.question as string | null,
    answer: dto.answer,
    isRiskEvidence: dto.isRiskEvidence,
    sentimentLabel: dto.sentimentLabel as EvidenceSentence['sentimentLabel'],
    scaleLabel: dto.scaleLabel as EvidenceSentence['scaleLabel'],
    questionCreatedAt: dto.questionCreatedAt as string | null,
    answerCreatedAt: dto.answerCreatedAt,
  }
}

// emotionIndex는 생성된 API 타입보다 실제 런타임 계약이 좁아 이 경계에서 number로 변환한다.
// DB 컬럼 ONE_LINE_SUMMARY는 유지하되
// 프론트·백엔드·FastAPI 사이의 외부 JSON 필드명은 conversationSummary로 통일한다.
function toDailyReport(dto: DailyReportResponseDto): DailyReport {
  const emotionScore = dto.emotionIndex as number | null
  return {
    date: dto.reportDate,
    seniorId: String(dto.seniorId),
    emotionScore,
    // 일간 리포트 응답엔 emotionLevel 필드 자체가 없다(GuardianDashboard/주간 응답과 달리
    // 점수만 온다) — entities/report/ui의 EmotionScoreCard와 같은 기준으로 직접 계산한다.
    emotionLevel: emotionScore === null ? null : getEmotionLevel(emotionScore),
    conversationSummary: dto.conversationSummary as string | null,
    recommendedAction: dto.recommendedAction as string | null,
    evidenceSentences: dto.evidences.map(toEvidenceSentence),
  }
}

// 보호자 JWT로 대상 시니어가 정해지므로 seniorId는 요청/응답 모두 페이지에서 쓰지 않는다.
export async function fetchDailyReport(date: string): Promise<DailyReport> {
  const { data } = await apiClient.reports.reportsControllerGetDailyReport({ date })
  return toDailyReport(data)
}

// weeklySummary를 WeeklyReport.recommendedAction으로 맞춘다 — 주간 응답엔 일간과
// 달리 별도 recommendedAction 필드가 없고 이 한 문구가 그 역할을 겸한다.
function toWeeklyReport(dto: WeeklyReportResponseDto): WeeklyReport {
  return {
    weekStart: dto.weekStart,
    seniorId: String(dto.seniorId),
    averageScore: dto.averageScore as number | null,
    maxScore: dto.maxScore as number | null,
    minScore: dto.minScore as number | null,
    recommendedAction: dto.weeklySummary,
    dailyScores: dto.dailyReports.map((day) => ({
      date: day.date,
      emotionScore: day.emotionIndex as number | null,
      emotionLevel: emotionLevelFromApi(day.emotionLevel),
      comment: day.summary as string | null,
    })),
  }
}

export async function fetchWeeklyReport(weekStart: string): Promise<WeeklyReport> {
  const { data } = await apiClient.reports.reportsControllerGetWeeklyReport({ weekStart })
  return toWeeklyReport(data)
}

// 보호자 리포트 화면들의 날짜/주 네비게이션이 "리포트가 있는 날"을 표시하는 데 쓴다.
export interface ReportCalendar {
  dailyReportStatusByDate: Map<string, 'WAITING' | 'COMPLETED' | 'FAILED'>
  weekStartsWithWeeklyReport: Set<string>
}

export async function fetchReportCalendar(year: number, month: number): Promise<ReportCalendar> {
  const { data } = await apiClient.reports.reportsControllerGetReportCalendar({ year, month })
  return {
    dailyReportStatusByDate: new Map(
      data.dailyReports.map((item) => [item.date, item.generationStatus]),
    ),
    weekStartsWithWeeklyReport: new Set(data.weeklyReports.map((item) => item.weekStart)),
  }
}

function toGuardianDashboard(dto: GuardianDashboardResponseDto): GuardianDashboard {
  return {
    guardianName: dto.guardian.name,
    seniorName: dto.senior.name,
    seniorConnectedAt: dto.senior.connectedAt,
    daysTogether: dto.senior.daysTogether,
    dasolMessage: dto.dasolMessage,
    latestDailyReport: {
      emotionScore: dto.latestDailyReport.emotionIndex as number | null,
      emotionLevel: emotionLevelFromApi(dto.latestDailyReport.emotionLevel),
      conversationSummary: dto.latestDailyReport.conversationSummary as string | null,
      recommendedAction: dto.latestDailyReport.recommendedAction as string | null,
    },
    recentSevenDays: dto.recentSevenDays.map((point) => ({
      date: point.date,
      emotionScore: point.emotionIndex as number | null,
    })),
  }
}

export async function fetchGuardianDashboard(): Promise<GuardianDashboard> {
  const { data } = await apiClient.guardian.guardianDashboardControllerGetDashboard()
  return toGuardianDashboard(data)
}
