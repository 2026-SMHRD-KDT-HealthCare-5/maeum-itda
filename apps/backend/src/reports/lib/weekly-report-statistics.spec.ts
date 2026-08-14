/* 역할: 유효한 일간 점수만으로 주간 통계와 PNG 점수 등급이 계산되는지 검증한다. */
import {
  calculateWeeklyReportStatistics,
  EmotionLevel,
  toEmotionLevel,
} from './weekly-report-statistics';

describe('weekly report statistics', () => {
  it('데이터 부족일을 제외해 평균·최고·최저를 계산한다', () => {
    expect(
      calculateWeeklyReportStatistics([55, 83, null, 41, 65, 52, 93]),
    ).toEqual({
      validDays: 6,
      averageScore: 65,
      maxScore: 93,
      minScore: 41,
    });
  });

  it('유효한 일간 점수가 3일 미만이면 통계를 null로 반환한다', () => {
    expect(calculateWeeklyReportStatistics([80, null])).toEqual({
      validDays: 1,
      averageScore: null,
      maxScore: null,
      minScore: null,
    });
  });

  it.each([
    [0, EmotionLevel.BAD],
    [49, EmotionLevel.BAD],
    [50, EmotionLevel.NORMAL],
    [69, EmotionLevel.NORMAL],
    [70, EmotionLevel.GOOD],
    [100, EmotionLevel.GOOD],
    [null, null],
  ])('점수 %s를 %s 등급으로 변환한다', (score, level) => {
    expect(toEmotionLevel(score)).toBe(level);
  });
});
