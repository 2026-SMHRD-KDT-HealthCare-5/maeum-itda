/* 역할: 척도별 동일 가중 평균과 데이터 부족 정책으로 일간 정서지수가 계산되는지 검증한다. */
import { ScaleType } from '../../analysis/entities/scale-question-analysis.entity';
import {
  calculateDailyEmotionIndex,
  DailyScaleAnalysisInput,
} from './daily-emotion-index.calculator';

describe('calculateDailyEmotionIndex', () => {
  const analysis = (
    scaleAnalysisId: number,
    scaleType: ScaleType,
    questionNumber: number,
    analysisScore: 0 | 1,
    analyzedAt = '2026-08-14T01:00:00.000Z',
  ): DailyScaleAnalysisInput => ({
    scaleAnalysisId,
    scaleType,
    questionNumber,
    analysisScore,
    analyzedAt: new Date(analyzedAt),
  });

  it('척도별 위험 비율을 동일 가중치로 평균해 0~100 지수를 계산한다', () => {
    const result = calculateDailyEmotionIndex([
      analysis(1, ScaleType.SGDS_K, 1, 1),
      analysis(2, ScaleType.SGDS_K, 2, 1),
      analysis(3, ScaleType.SGDS_K, 3, 0),
      analysis(4, ScaleType.SGDS_K, 4, 0),
      analysis(5, ScaleType.GAD_7, 1, 1),
      analysis(6, ScaleType.GAD_7, 2, 0),
      analysis(7, ScaleType.GAD_7, 3, 0),
    ]);

    expect(result.status).toBe('COMPLETED');
    expect(result.emotionIndex).toBe(58);
    expect(result.scaleRiskRatios).toEqual([
      {
        scaleType: ScaleType.SGDS_K,
        answeredQuestionCount: 4,
        riskQuestionCount: 2,
        riskRatio: 0.5,
      },
      {
        scaleType: ScaleType.GAD_7,
        answeredQuestionCount: 3,
        riskQuestionCount: 1,
        riskRatio: 1 / 3,
      },
    ]);
  });

  it('등장하지 않은 척도는 평균에서 제외한다', () => {
    const result = calculateDailyEmotionIndex([
      analysis(1, ScaleType.GAD_7, 1, 0),
      analysis(2, ScaleType.GAD_7, 2, 0),
      analysis(3, ScaleType.GAD_7, 3, 0),
      analysis(4, ScaleType.GAD_7, 4, 0),
      analysis(5, ScaleType.GAD_7, 5, 0),
    ]);

    expect(result.status).toBe('COMPLETED');
    expect(result.emotionIndex).toBe(100);
    expect(result.scaleRiskRatios).toHaveLength(1);
  });

  it('고유 응답 완료 문항이 5개 미만이면 데이터 부족으로 처리한다', () => {
    const result = calculateDailyEmotionIndex([
      analysis(1, ScaleType.SGDS_K, 1, 0),
      analysis(2, ScaleType.SGDS_K, 2, 0),
      analysis(3, ScaleType.GAD_7, 1, 0),
      analysis(4, ScaleType.LSNS_6, 1, 0),
    ]);

    expect(result).toMatchObject({
      status: 'INSUFFICIENT_DATA',
      emotionIndex: null,
      answeredQuestionCount: 4,
    });
    expect(result.scaleRiskRatios).toHaveLength(3);
  });

  it('같은 척도·문항은 가장 최근 분석 결과만 사용한다', () => {
    const result = calculateDailyEmotionIndex([
      analysis(1, ScaleType.GAD_7, 1, 1, '2026-08-14T01:00:00.000Z'),
      analysis(2, ScaleType.GAD_7, 1, 0, '2026-08-14T02:00:00.000Z'),
      analysis(3, ScaleType.GAD_7, 2, 0),
      analysis(4, ScaleType.GAD_7, 3, 0),
      analysis(5, ScaleType.GAD_7, 4, 0),
      analysis(6, ScaleType.GAD_7, 5, 0),
    ]);

    expect(result.status).toBe('COMPLETED');
    expect(result.answeredQuestionCount).toBe(5);
    expect(result.emotionIndex).toBe(100);
  });
});
