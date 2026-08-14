/*
역할: 근거 조회 raw 행을 보호자 화면의 질문·답변 단위 JSON으로 변환한다.
주의: 한 답변에 분석 행이 여러 개여도 한 문장으로 합치고 위험 점수는 하나라도 1이면 강조한다.
*/
import { ScaleType } from '../../analysis/entities/scale-question-analysis.entity';
import { SentimentLabel } from '../../analysis/entities/emotion-tag.entity';
import {
  DailyEvidenceScaleLabel,
  DailyEvidenceSentimentLabel,
  DailyReportEvidenceResponseDto,
} from '../dto/daily-report-response.dto';
import type { DailyEvidenceRawRow } from '../repositories/daily-report-evidence.repository';

const scaleLabels: Record<ScaleType, DailyEvidenceScaleLabel> = {
  [ScaleType.SGDS_K]: DailyEvidenceScaleLabel.SGDS_K,
  [ScaleType.GAD_7]: DailyEvidenceScaleLabel.GAD_7,
  [ScaleType.LSNS_6]: DailyEvidenceScaleLabel.LSNS_6,
};

const sentimentLabels: Record<SentimentLabel, DailyEvidenceSentimentLabel> = {
  [SentimentLabel.POSITIVE]: DailyEvidenceSentimentLabel.POSITIVE,
  [SentimentLabel.NEUTRAL]: DailyEvidenceSentimentLabel.NEUTRAL,
  [SentimentLabel.NEGATIVE]: DailyEvidenceSentimentLabel.NEGATIVE,
};

export function mapDailyEvidenceRows(
  rows: DailyEvidenceRawRow[],
): DailyReportEvidenceResponseDto[] {
  const evidenceByMessage = new Map<number, DailyReportEvidenceResponseDto>();

  for (const row of rows) {
    const messageId = Number(row.answerMessageId);
    const existing = evidenceByMessage.get(messageId);
    const isRiskEvidence = Number(row.analysisScore) === 1;
    const scaleLabel = row.scaleType ? scaleLabels[row.scaleType] : null;
    const sentimentLabel = row.sentimentLabel
      ? sentimentLabels[row.sentimentLabel]
      : null;

    if (existing) {
      existing.isRiskEvidence ||= isRiskEvidence;
      existing.scaleLabel ??= scaleLabel;
      existing.sentimentLabel ??= sentimentLabel;
      continue;
    }

    evidenceByMessage.set(messageId, {
      messageId,
      question: row.question,
      answer: row.answer,
      isRiskEvidence,
      sentimentLabel,
      scaleLabel,
      questionCreatedAt: row.questionCreatedAt,
      answerCreatedAt: row.answerCreatedAt,
    });
  }

  return [...evidenceByMessage.values()];
}
