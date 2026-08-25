/*
역할: 보호자 알림함의 목록 조회와 읽음 처리를 제공한다.
흐름: Bearer 인증 -> 보호자 역할 확인 -> NotificationsService -> 알림 Repository -> MySQL
*/
import {
  Controller,
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import type { AuthenticatedRequest } from '../auth/access-token.guard';
import { ApiErrorResponseDto } from '../common/dto/api-error-response.dto';
import { NotificationListQueryDto } from './dto/notification-list-query.dto';
import { NotificationListResponseDto } from './dto/notification-response.dto';
import { NotificationsService } from './notifications.service';
import {
  DeletePushSubscriptionDto,
  PushSubscriptionResponseDto,
  UpsertPushSubscriptionDto,
  VapidPublicKeyResponseDto,
} from './dto/push-subscription.dto';
import { PushSubscriptionsService } from './push-subscriptions.service';
import { WebPushDeliveryService } from './web-push-delivery.service';

@ApiTags('6. 보호자 알림')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
@ApiForbiddenResponse({ type: ApiErrorResponseDto })
@UseGuards(AccessTokenGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushSubscriptionsService: PushSubscriptionsService,
    private readonly webPushDeliveryService: WebPushDeliveryService,
  ) {}

  @Get('push/vapid-public-key')
  @ApiOperation({ summary: '브라우저 웹 푸시 구독용 VAPID 공개키 조회' })
  @ApiOkResponse({ type: VapidPublicKeyResponseDto })
  @ApiServiceUnavailableResponse({
    description: '서버에 VAPID 키가 설정되지 않음',
    type: ApiErrorResponseDto,
  })
  getVapidPublicKey(): VapidPublicKeyResponseDto {
    return { publicKey: this.webPushDeliveryService.getPublicKey() };
  }

  @Put('push-subscriptions')
  @ApiOperation({ summary: '웹 푸시 구독 등록·갱신 (보호자/시니어 공용)' })
  @ApiOkResponse({ type: PushSubscriptionResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  upsertPushSubscription(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpsertPushSubscriptionDto,
  ): Promise<PushSubscriptionResponseDto> {
    return this.pushSubscriptionsService.upsert(
      request.user,
      dto,
      request.headers['user-agent'],
    );
  }

  @Delete('push-subscriptions')
  @HttpCode(204)
  @ApiOperation({
    summary: '현재 브라우저 웹 푸시 구독 해제 (보호자/시니어 공용)',
  })
  @ApiNoContentResponse({ description: '구독 해제 완료' })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  async deletePushSubscription(
    @Req() request: AuthenticatedRequest,
    @Body() dto: DeletePushSubscriptionDto,
  ): Promise<void> {
    await this.pushSubscriptionsService.remove(request.user, dto);
  }

  @Get()
  @ApiOperation({ summary: '보호자 알림 목록 조회' })
  @ApiOkResponse({ type: NotificationListResponseDto })
  getNotifications(
    @Req() request: AuthenticatedRequest,
    @Query() query: NotificationListQueryDto,
  ): Promise<NotificationListResponseDto> {
    return this.notificationsService.getNotifications(request.user, query);
  }

  @Patch(':alertId/read')
  @HttpCode(204)
  @ApiOperation({ summary: '보호자 알림 한 건 읽음 처리' })
  @ApiNoContentResponse({ description: '읽음 처리 완료' })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async markAsRead(
    @Req() request: AuthenticatedRequest,
    @Param('alertId', ParseIntPipe) alertId: number,
  ): Promise<void> {
    await this.notificationsService.markAsRead(request.user, alertId);
  }

  @Patch(':alertId/unread')
  @HttpCode(204)
  @ApiOperation({ summary: '보호자 알림 한 건 읽지 않음으로 되돌리기' })
  @ApiNoContentResponse({ description: '읽지 않음 처리 완료' })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async markAsUnread(
    @Req() request: AuthenticatedRequest,
    @Param('alertId', ParseIntPipe) alertId: number,
  ): Promise<void> {
    await this.notificationsService.markAsUnread(request.user, alertId);
  }

  @Patch('read-all')
  @HttpCode(204)
  @ApiOperation({ summary: '보호자 알림 모두 읽음 처리' })
  @ApiNoContentResponse({ description: '모두 읽음 처리 완료' })
  async markAllAsRead(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.notificationsService.markAllAsRead(request.user);
  }
}
