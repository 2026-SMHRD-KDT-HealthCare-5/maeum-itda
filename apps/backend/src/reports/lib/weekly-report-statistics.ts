/* 역할: 데이터가 충분한 일간 정서지수만으로 주간 평균·최고·최저와 화면 등급을 계산한다. */
export enum EmotionLevel {
  BAD = 'BAD',
  NORMAL = 'NORMAL',
  GOOD = 'GOOD',
}

export const MIN_WEEKLY_VALID_DAYS = 3;

export interface WeeklyReportStatistics {
  validDays: number;
  averageScore: number | null;
  maxScore: number | null;
  minScore: number | null;
}

export function calculateWeeklyReportStatistics(
  scores: Array<number | null>,
): WeeklyReportStatistics {
  const validScores = scores.filter((score): score is number => score !== null);
  if (validScores.length < MIN_WEEKLY_VALID_DAYS) {
    return {
      validDays: validScores.length,
      averageScore: null,
      maxScore: null,
      minScore: null,
    };
  }

  return {
    validDays: validScores.length,
    averageScore: Math.round(
      validScores.reduce((sum, score) => sum + score, 0) / validScores.length,
    ),
    maxScore: Math.max(...validScores),
    minScore: Math.min(...validScores),
  };
}

// 보호자 주간 리포트 states PNG의 색상 범례(0~49/50~69/70~100)를 따른다.
export function toEmotionLevel(score: number | null): EmotionLevel | null {
  if (score === null) return null;
  if (score < 50) return EmotionLevel.BAD;
  if (score < 70) return EmotionLevel.NORMAL;
  return EmotionLevel.GOOD;
}
