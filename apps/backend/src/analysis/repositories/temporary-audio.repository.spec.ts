/* 역할: 질문별 음성 답변 묶음의 메모리 저장·조회·삭제를 검증한다. */
import type { QuestionAnswerBatch } from '../dto/audio-analysis.contract';
import { TemporaryAudioRepository } from './temporary-audio.repository';

describe('TemporaryAudioRepository', () => {
  it('질문 메시지 ID를 기준으로 묶음을 저장하고 삭제한다', () => {
    const repository = new TemporaryAudioRepository();
    const batch: QuestionAnswerBatch = {
      questionMessageId: 9,
      seniorId: 7,
      generationId: 'generation-1',
      continueConversation: true,
      answers: [],
    };
    repository.save(batch);
    expect(repository.findByQuestionMessageId(9)).toEqual(batch);
    repository.delete(9);
    expect(repository.findByQuestionMessageId(9)).toBeUndefined();
  });
});
