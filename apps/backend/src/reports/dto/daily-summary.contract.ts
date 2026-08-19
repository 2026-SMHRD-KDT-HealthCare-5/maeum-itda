/*
역할: NestJS 일간 리포트 생성기와 FastAPI 일간 요약 API 사이의 내부 계약을 정의한다.
전체 흐름: DailySummaryContextRepository -> DailySummaryClient -> POST /reports/daily-summary
*/
import type { SentimentLabel } from '../../analysis/entities/emotion-tag.entity';
import type { SpeakerType } from '../../chats/entities/conversation-message.entity';

export interface DailySummaryTurn {
  speakerType: SpeakerType;
  content: string;
  sentimentLabel: SentimentLabel | null;
}

export interface DailySummaryRequest {
  seniorId: number;
  reportDate: string;
  turns: DailySummaryTurn[];
}

export interface DailySummaryResult {
  conversationSummary: string | null;
  recommendedAction: string | null;
}
