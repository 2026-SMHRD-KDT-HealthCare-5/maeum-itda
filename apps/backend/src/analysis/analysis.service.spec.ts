/* 역할: FastAPI 주소 미설정 시 질문별 음성 묶음을 메모리에 보관하고 분석 호출은 보류하는지, REST 소유권 검증이 올바른지 검증한다. */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/auth.service';
import { UserRole } from '../users/entities/user.entity';
import type { AiClient } from './ai.client';
import { AnalysisService } from './analysis.service';
import type { QuestionAnswerBatch } from './dto/audio-analysis.contract';
import type { AnalysisResultRepository } from './repositories/analysis-result.repository';
import type { TemporaryAudioRepository } from './repositories/temporary-audio.repository';
import type { AnalysisContextRepository } from './repositories/analysis-context.repository';

describe('AnalysisService', () => {
  it('FastAPI 주소 미설정 상태에서 묶음을 저장하고 분석 호출은 보류한다', async () => {
    const aiClient = {
      isConfigured: jest.fn().mockReturnValue(false),
      analyzeAnswerBatch: jest.fn(),
    };
    const temporaryAudioRepository = {
      save: jest.fn(),
      findByQuestionMessageId: jest.fn(),
      delete: jest.fn(),
    };
    const analysisResultRepository = {
      saveCompleted: jest.fn(),
      findStatus: jest.fn(),
    };
    const analysisContextRepository = { findForBatch: jest.fn() };
    const service = new AnalysisService(
      aiClient as unknown as AiClient,
      temporaryAudioRepository as unknown as TemporaryAudioRepository,
      analysisResultRepository as unknown as AnalysisResultRepository,
      analysisContextRepository as unknown as AnalysisContextRepository,
    );
    const batch: QuestionAnswerBatch = {
      questionMessageId: 9,
      seniorId: 7,
      generationId: 'generation-1',
      continueConversation: true,
      answers: [
        {
          tempAnswerId: 10,
          seniorId: 7,
          questionMessageId: 9,
          generationId: 'generation-1',
          audioTransferId: 'audio-1',
          mimeType: 'audio/webm',
          capturedAt: '2026-08-11T00:00:00.000Z',
          endType: 'manual',
          audioBuffer: Buffer.from([1]),
          continueConversation: true,
        },
      ],
    };

    service.enqueueAnswerBatch(batch);
    const result = await service.processPendingAnswerBatch(9, () => true);

    expect(temporaryAudioRepository.save).toHaveBeenCalledWith(batch);
    expect(aiClient.analyzeAnswerBatch).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('FastAPI 왕복 사이에 대화가 종료돼 isStillCurrent가 false를 반환하면 다음 질문을 저장하지 않는다', async () => {
    const aiClient = {
      isConfigured: jest.fn().mockReturnValue(true),
      analyzeAnswerBatch: jest.fn().mockResolvedValue({
        answers: [
          {
            tempAnswerId: 10,
            transcript: '오늘 산책했어요.',
            sentimentLabel: 'POSITIVE',
            scaleAnalyses: [],
          },
        ],
        nextQuestion: '산책하면서 무엇이 좋으셨어요?',
      }),
    };
    const batch: QuestionAnswerBatch = {
      questionMessageId: 9,
      seniorId: 7,
      generationId: 'generation-1',
      continueConversation: true,
      answers: [
        {
          tempAnswerId: 10,
          seniorId: 7,
          questionMessageId: 9,
          generationId: 'generation-1',
          audioTransferId: 'audio-1',
          mimeType: 'audio/webm',
          capturedAt: '2026-08-11T00:00:00.000Z',
          endType: 'manual',
          audioBuffer: Buffer.from([1]),
          continueConversation: true,
        },
      ],
    };
    const temporaryAudioRepository = {
      save: jest.fn(),
      findByQuestionMessageId: jest.fn().mockReturnValue(batch),
      delete: jest.fn(),
    };
    const analysisResultRepository = {
      saveCompleted: jest.fn().mockResolvedValue({
        answerTranscripts: [{ messageId: 102, content: '오늘 산책했어요.' }],
        nextQuestion: null,
      }),
      findStatus: jest.fn(),
    };
    const analysisContextRepository = {
      findForBatch: jest.fn().mockResolvedValue({}),
    };
    const service = new AnalysisService(
      aiClient as unknown as AiClient,
      temporaryAudioRepository as unknown as TemporaryAudioRepository,
      analysisResultRepository as unknown as AnalysisResultRepository,
      analysisContextRepository as unknown as AnalysisContextRepository,
    );

    // FastAPI 왕복(수 초)이 끝난 시점엔 대화가 이미 끝났다고 가정한다 — 답변된
    // 시각 이후 chat:end가 먼저 도착한 상황을 흉내낸다.
    await service.processPendingAnswerBatch(9, () => false);

    expect(analysisResultRepository.saveCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ continueConversation: false }),
      expect.any(String),
      expect.anything(),
    );
  });

  describe('getStatusForSenior', () => {
    const seniorAuth: AccessTokenPayload = { sub: 7, role: UserRole.SENIOR };
    const guardianAuth: AccessTokenPayload = {
      sub: 7,
      role: UserRole.GUARDIAN,
    };

    function createService(ownerSeniorId: number | null, status: unknown) {
      const analysisResultRepository = {
        saveCompleted: jest.fn(),
        findStatus: jest.fn().mockResolvedValue(status),
        findMessageSeniorId: jest.fn().mockResolvedValue(ownerSeniorId),
      };
      const service = new AnalysisService(
        {} as unknown as AiClient,
        {} as unknown as TemporaryAudioRepository,
        analysisResultRepository as unknown as AnalysisResultRepository,
        {} as unknown as AnalysisContextRepository,
      );
      return { service, analysisResultRepository };
    }

    it('시니어 계정이 아니면 거부한다', async () => {
      const { service } = createService(7, { processingStatus: 'COMPLETED' });
      await expect(
        service.getStatusForSenior(102, guardianAuth),
      ).rejects.toThrow(ForbiddenException);
    });

    it('메시지가 없으면 null을 그대로 반환한다(컨트롤러가 404로 처리)', async () => {
      const { service } = createService(null, null);
      await expect(
        service.getStatusForSenior(102, seniorAuth),
      ).resolves.toBeNull();
    });

    it('다른 시니어의 메시지면 거부한다', async () => {
      const { service } = createService(99, { processingStatus: 'COMPLETED' });
      await expect(service.getStatusForSenior(102, seniorAuth)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('본인 메시지면 상태를 반환한다', async () => {
      const status = { processingStatus: 'COMPLETED' };
      const { service } = createService(7, status);
      await expect(
        service.getStatusForSenior(102, seniorAuth),
      ).resolves.toEqual(status);
    });
  });

  describe('retryPendingAnswerBatchForSenior', () => {
    const seniorAuth: AccessTokenPayload = { sub: 7, role: UserRole.SENIOR };
    const guardianAuth: AccessTokenPayload = {
      sub: 7,
      role: UserRole.GUARDIAN,
    };
    const batch: QuestionAnswerBatch = {
      questionMessageId: 9,
      seniorId: 7,
      generationId: 'generation-1',
      continueConversation: true,
      answers: [],
    };

    function createService(foundBatch: QuestionAnswerBatch | undefined) {
      const aiClient = { isConfigured: jest.fn().mockReturnValue(false) };
      const temporaryAudioRepository = {
        findByQuestionMessageId: jest.fn().mockReturnValue(foundBatch),
        delete: jest.fn(),
      };
      const service = new AnalysisService(
        aiClient as unknown as AiClient,
        temporaryAudioRepository as unknown as TemporaryAudioRepository,
        {} as unknown as AnalysisResultRepository,
        {} as unknown as AnalysisContextRepository,
      );
      return { service };
    }

    it('시니어 계정이 아니면 거부한다', async () => {
      const { service } = createService(batch);
      await expect(
        service.retryPendingAnswerBatchForSenior(9, guardianAuth),
      ).rejects.toThrow(ForbiddenException);
    });

    it('대기 중인 배치가 없으면 404다', async () => {
      const { service } = createService(undefined);
      await expect(
        service.retryPendingAnswerBatchForSenior(9, seniorAuth),
      ).rejects.toThrow(NotFoundException);
    });

    it('다른 시니어의 배치면 거부한다', async () => {
      const { service } = createService({ ...batch, seniorId: 99 });
      await expect(
        service.retryPendingAnswerBatchForSenior(9, seniorAuth),
      ).rejects.toThrow(ForbiddenException);
    });

    it('본인 배치면 재시도를 진행한다', async () => {
      const { service } = createService(batch);
      await expect(
        service.retryPendingAnswerBatchForSenior(9, seniorAuth),
      ).resolves.toBeNull(); // FastAPI 미설정이라 processPendingAnswerBatch가 null 반환
    });
  });
});
