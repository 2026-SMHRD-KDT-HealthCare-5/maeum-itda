/* 역할: 알림함 화면이 목록, 읽지 않은 개수, 리포트 이동 대상을 한 응답으로 받게 한다. */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AlertType } from '../entities/guardian-notification.entity';

export enum NotificationTargetType {
  DAILY_REPORT = 'DAILY_REPORT',
  WEEKLY_REPORT = 'WEEKLY_REPORT',
}

export class NotificationTargetDto {
  @ApiProperty({ enum: NotificationTargetType })
  type: NotificationTargetType;

  @ApiPropertyOptional({ nullable: true, example: 31 })
  reportId: number | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-08-13' })
  reportDate: string | null;

  @ApiPropertyOptional({ nullable: true, example: 10 })
  weeklyReportId: number | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-08-03' })
  weekStart: string | null;
}

export class NotificationItemDto {
  @ApiProperty({ example: 15 })
  alertId: number;

  @ApiProperty({ enum: AlertType })
  type: AlertType;

  @ApiProperty({ example: '정서지수 하락 감지' })
  title: string;

  @ApiProperty({ example: '어르신의 정서지수가 설정한 기준보다 낮아요.' })
  content: string;

  @ApiProperty({ example: false })
  isRead: boolean;

  @ApiProperty({ example: '2026-08-14T00:31:00.000Z' })
  createdAt: Date;

  @ApiProperty({ type: NotificationTargetDto })
  target: NotificationTargetDto;
}

export class NotificationListResponseDto {
  @ApiProperty({ type: [NotificationItemDto] })
  notifications: NotificationItemDto[];

  @ApiPropertyOptional({ nullable: true, example: 7 })
  nextCursor: number | null;

  @ApiProperty({ example: 2 })
  unreadCount: number;
}
