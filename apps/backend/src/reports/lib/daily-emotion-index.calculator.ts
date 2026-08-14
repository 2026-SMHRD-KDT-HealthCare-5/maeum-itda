/*
역할: 하루의 척도 문항 0/1 결과를 척도별로 정규화한 뒤 0~100 정서지수로 계산한다.
전체 흐름: ReportsService → calculateDailyEmotionIndex() → DailyReportRepository 저장
주의: FastAPI를 다시 호출하지 않으며 동일 척도·문항은 가장 최근 분석 한 건만 집계한다.
*/
import { ScaleType } from '../../analysis/entities/scale-question-analysis.entity';

export const MINIMUM_DAILY_ANSWERED_QUESTIONS = 5;

export interface DailyScaleAnalysisInput {
  scaleAnalysisId: number;
  scaleType: ScaleType;
  questionNumber: number;
  analysisScore: 0 | 1;
  analyzedAt: Date;
}

export interface ScaleRiskRatio {
  scaleType: ScaleType;
  answeredQuestionCount: number;
  riskQuestionCount: number;
  riskRatio: number;
}

export type DailyEmotionIndexCalculation =
  | {
      status: 'INSUFFICIENT_DATA';
      emotionIndex: null;
      answeredQuestionCount: number;
      scaleRiskRatios: ScaleRiskRatio[];
    }
  | {
      status: 'COMPLETED';
      emotionIndex: number;
      answeredQuestionCount: number;
      scaleRiskRatios: ScaleRiskRatio[];
    };

export function calculateDailyEmotionIndex(
  analyses: DailyScaleAnalysisInput[],
): DailyEmotionIndexCalculation {
  const latestByQuestion = selectLatestAnalysisByQuestion(analyses);
  const scaleRiskRatios = calculateScaleRiskRatios(latestByQuestion);
  const answeredQuestionCount = latestByQuestion.length;

  if (answeredQuestionCount < MINIMUM_DAILY_ANSWERED_QUESTIONS) {
    return {
      status: 'INSUFFICIENT_DATA',
      emotionIndex: null,
      answeredQuestionCount,
      scaleRiskRatios,
    };
  }

  const riskRatio =
    scaleRiskRatios.reduce((sum, scale) => sum + scale.riskRatio, 0) /
    scaleRiskRatios.length;
  return {
    status: 'COMPLETED',
    emotionIndex: Math.round((1 - riskRatio) * 100),
    answeredQuestionCount,
    scaleRiskRatios,
  };
}

function selectLatestAnalysisByQuestion(
  analyses: DailyScaleAnalysisInput[],
): DailyScaleAnalysisInput[] {
  const latestByQuestion = new Map<string, DailyScaleAnalysisInput>();

  for (const analysis of analyses) {
    validateAnalysis(analysis);
    const key = `${analysis.scaleType}:${analysis.questionNumber}`;
    const existing = latestByQuestion.get(key);
    if (existing === undefined || isLaterAnalysis(analysis, existing)) {
      latestByQuestion.set(key, analysis);
    }
  }

  return [...latestByQuestion.values()];
}

function calculateScaleRiskRatios(
  analyses: DailyScaleAnalysisInput[],
): ScaleRiskRatio[] {
  const grouped = new Map<ScaleType, DailyScaleAnalysisInput[]>();
  for (const analysis of analyses) {
    const values = grouped.get(analysis.scaleType) ?? [];
    values.push(analysis);
    grouped.set(analysis.scaleType, values);
  }

  return [...grouped.entries()].map(([scaleType, values]) => {
    const riskQuestionCount = values.reduce(
      (sum, value) => sum + value.analysisScore,
      0,
    );
    return {
      scaleType,
      answeredQuestionCount: values.length,
      riskQuestionCount,
      riskRatio: riskQuestionCount / values.length,
    };
  });
}

function isLaterAnalysis(
  candidate: DailyScaleAnalysisInput,
  existing: DailyScaleAnalysisInput,
): boolean {
  const timeDifference =
    candidate.analyzedAt.getTime() - existing.analyzedAt.getTime();
  return (
    timeDifference > 0 ||
    (timeDifference === 0 &&
      candidate.scaleAnalysisId > existing.scaleAnalysisId)
  );
}

function validateAnalysis(analysis: DailyScaleAnalysisInput): void {
  if (analysis.analysisScore !== 0 && analysis.analysisScore !== 1) {
    throw new Error('일간 집계 대상 문항 점수는 0 또는 1이어야 합니다.');
  }
  if (Number.isNaN(analysis.analyzedAt.getTime())) {
    throw new Error('일간 집계 대상 분석 시각이 올바르지 않습니다.');
  }
}
