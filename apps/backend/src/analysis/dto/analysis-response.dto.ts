/*
역할: 음성 분석 상태 조회와 수동 재시도 결과를 OpenAPI 응답 스키마로 제공한다.
연결 흐름: AnalysisController → AnalysisService → 응답 DTO 문서 → NestJS API 호출자
*/
import { ApiProperty } from '@nestjs/swagger';
import { ProcessingStatus } from '../entities/voice-analysis-status.entity';

export class VoiceAnalysisStatusResponseDto {
  @ApiProperty({ description: '음성 분석 상태 행 ID', example: 10 })
  voiceAnalysisId: number;

  @ApiProperty({ description: '분석 대상 메시지 ID', example: 101 })
  messageId: number;

  @ApiProperty({ description: '음성 분석 처리 상태', enum: ProcessingStatus })
  processingStatus: ProcessingStatus;

  @ApiProperty({
    description: '분석 완료 시각. 완료 전에는 null',
    example: '2026-08-13T09:00:10.000Z',
    format: 'date-time',
    nullable: true,
  })
  analyzedAt: Date | null;

  @ApiProperty({
    description: '분석 실패 원인. 실패 상태가 아니면 null',
    example: null,
    type: String,
    nullable: true,
  })
  errorMessage: string | null;
}

export class NextQuestionResponseDto {
  @ApiProperty({ description: '다음 AI 질문 메시지 ID', example: 102 })
  messageId: number;

  @ApiProperty({
    description: '다음 질문 생성 작업 ID',
    example: '2c090794-f585-49dc-9588-43aeb3f0f09f',
  })
  generationId: string;

  @ApiProperty({
    description: '다음 AI 질문 내용',
    example: '그때 어떤 기분이 드셨나요?',
  })
  content: string;
}

export class RetryAudioAnalysisResponseDto {
  @ApiProperty({
    description: '분석을 완료한 답변 메시지 ID 목록',
    example: [103, 104],
    type: [Number],
  })
  answerMessageIds: number[];

  @ApiProperty({
    description: '새로 생성한 다음 질문. 대화 종료 상태이면 null',
    type: NextQuestionResponseDto,
    nullable: true,
  })
  nextQuestion: NextQuestionResponseDto | null;
}
