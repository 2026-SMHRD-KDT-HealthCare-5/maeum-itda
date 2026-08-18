/* 역할: 오늘 이미 채점된 문항을 제외하고 FastAPI에 보낼 미채점 목록을 계산하는지 검증한다. */
import { ScaleType } from '../entities/scale-question-analysis.entity';
import { buildPendingScaleItems } from './analysis-context.repository';

describe('buildPendingScaleItems', () => {
  it('척도별 전체 범위에서 이미 채점된 문항만 제외한다', () => {
    const result = buildPendingScaleItems([
      { scaleType: ScaleType.SGDS_K, questionNumber: 1 },
      { scaleType: ScaleType.GAD_7, questionNumber: 7 },
      { scaleType: ScaleType.LSNS_6, questionNumber: 3 },
    ]);

    expect(result.SGDS_K).not.toContain('1');
    expect(result.SGDS_K).toHaveLength(14);
    expect(result.GAD_7).not.toContain('7');
    expect(result.GAD_7).toHaveLength(6);
    expect(result.LSNS_6).not.toContain('3');
    expect(result.LSNS_6).toHaveLength(5);
  });
});
