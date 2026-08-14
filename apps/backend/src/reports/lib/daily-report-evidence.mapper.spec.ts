import { ScaleType } from '../../analysis/entities/scale-question-analysis.entity';
import { SentimentLabel } from '../../analysis/entities/emotion-tag.entity';
import { mapDailyEvidenceRows } from './daily-report-evidence.mapper';

describe('mapDailyEvidenceRows', () => {
  it('같은 답변의 여러 분석 행을 하나의 위험 근거 문장으로 합친다', () => {
    const common = {
      answerMessageId: 101,
      question: '오늘 기분은 어떠세요?',
      answer: '조금 불안해.',
      questionCreatedAt: new Date('2026-08-14T01:00:00.000Z'),
      answerCreatedAt: new Date('2026-08-14T01:01:00.000Z'),
      sentimentLabel: SentimentLabel.NEGATIVE,
    };

    const result = mapDailyEvidenceRows([
      {
        ...common,
        scaleType: ScaleType.GAD_7,
        analysisScore: 0,
      },
      {
        ...common,
        scaleType: ScaleType.GAD_7,
        analysisScore: 1,
      },
    ]);

    expect(result).toEqual([
      {
        messageId: 101,
        question: '오늘 기분은 어떠세요?',
        answer: '조금 불안해.',
        isRiskEvidence: true,
        sentimentLabel: '부정',
        scaleLabel: '불안',
        questionCreatedAt: new Date('2026-08-14T01:00:00.000Z'),
        answerCreatedAt: new Date('2026-08-14T01:01:00.000Z'),
      },
    ]);
  });

  it('감성 태그만 있는 답변도 비위험 근거로 반환한다', () => {
    const result = mapDailyEvidenceRows([
      {
        answerMessageId: 102,
        question: '오늘 무엇을 하셨어요?',
        answer: '가족과 산책했어.',
        questionCreatedAt: null,
        answerCreatedAt: new Date('2026-08-14T02:00:00.000Z'),
        scaleType: null,
        analysisScore: null,
        sentimentLabel: SentimentLabel.POSITIVE,
      },
    ]);

    expect(result[0]).toMatchObject({
      messageId: 102,
      isRiskEvidence: false,
      sentimentLabel: '긍정',
      scaleLabel: null,
    });
  });
});
