/*
역할: 척도별 동일 가중 평균과 데이터 부족 정책으로 일간 정서지수가 계산되는지 검증한다.
[2026-08-25] riskRatio 분모가 척도 전체 문항 정원(SGDS_K 15/GAD_7 7/LSNS_6 6)으로
바뀌어, 미확인 문항이 감점 없이 취급되는지도 함께 검증한다.
*/
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

  it('척도별 위험 비율을(전체 문항 정원 기준으로) 동일 가중치로 평균해 0~100 지수를 계산한다', () => {
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
    // SGDS_K: 2/15 (정원 15, 나머지 11문항은 미확인이라도 감점 없음)
    // GAD_7: 1/7 (정원 7)
    // 평균 = (2/15 + 1/7) / 2 ≈ 0.1381 → (1-0.1381)*100 ≈ 86.19 → 86
    expect(result.emotionIndex).toBe(86);
    expect(result.scaleRiskRatios).toEqual([
      {
        scaleType: ScaleType.SGDS_K,
        answeredQuestionCount: 4,
        riskQuestionCount: 2,
        riskRatio: 2 / 15,
      },
      {
        scaleType: ScaleType.GAD_7,
        answeredQuestionCount: 3,
        riskQuestionCount: 1,
        riskRatio: 1 / 7,
      },
    ]);
  });

  it('척도 전체 문항을 다 위험응답으로 채우면 그 척도는 0점 처리된다', () => {
    const result = calculateDailyEmotionIndex([
      analysis(1, ScaleType.LSNS_6, 1, 1),
      analysis(2, ScaleType.LSNS_6, 2, 1),
      analysis(3, ScaleType.LSNS_6, 3, 1),
      analysis(4, ScaleType.LSNS_6, 4, 1),
      analysis(5, ScaleType.LSNS_6, 5, 1),
      analysis(6, ScaleType.LSNS_6, 6, 1),
    ]);

    expect(result.status).toBe('COMPLETED');
    expect(result.emotionIndex).toBe(0);
    expect(result.scaleRiskRatios).toEqual([
      {
        scaleType: ScaleType.LSNS_6,
        answeredQuestionCount: 6,
        riskQuestionCount: 6,
        riskRatio: 1,
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
