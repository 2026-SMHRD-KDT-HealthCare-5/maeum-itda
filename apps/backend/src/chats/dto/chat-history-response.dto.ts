/*
역할: 과거 대화 cursor 조회 결과를 Swagger가 구체적인 배열·nullable 스키마로 생성하게 한다.
연결 흐름: ChatsController → ChatsService → ChatHistoryPageResponseDto → 프론트 대화 기록 API
*/
import { ApiProperty } from '@nestjs/swagger';
import {
  SpeakerType,
  SttStatus,
} from '../entities/conversation-message.entity';

export class ChatHistoryMessageDto {
  @ApiProperty({ description: '대화 메시지 ID', example: 101 })
  messageId: number;

  @ApiProperty({
    description: '발화 주체',
    enum: SpeakerType,
    example: SpeakerType.AI,
  })
  speakerType: SpeakerType;

  @ApiProperty({
    description: '메시지 내용. STT 처리 전 또는 실패 시 null일 수 있다.',
    example: '오늘 하루는 어땠나요?',
    type: String,
    nullable: true,
  })
  content: string | null;

  @ApiProperty({ description: 'STT 처리 상태', enum: SttStatus })
  sttStatus: SttStatus;

  @ApiProperty({
    description: '메시지 생성 시각',
    example: '2026-08-13T09:00:00.000Z',
    format: 'date-time',
  })
  createdAt: Date;
}

export class ChatHistoryPageResponseDto {
  @ApiProperty({
    description: '최신순 대화 메시지 목록',
    type: [ChatHistoryMessageDto],
  })
  messages: ChatHistoryMessageDto[];

  @ApiProperty({
    description: '다음 조회에 사용할 cursor. 다음 페이지가 없으면 null',
    example: 72,
    nullable: true,
  })
  nextCursor: number | null;
}
