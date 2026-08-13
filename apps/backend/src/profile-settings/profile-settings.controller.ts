/*
역할: 보호자·시니어 내 정보 화면의 역할별 알림 설정 REST API를 제공한다.
전체 흐름: 브라우저 → AccessTokenGuard → ProfileSettingsController → ProfileSettingsService → MySQL
*/
import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import type { AuthenticatedRequest } from '../auth/access-token.guard';
import { ApiErrorResponseDto } from '../common/dto/api-error-response.dto';
import {
  GuardianAlertSettingResponseDto,
  UpdateGuardianAlertSettingDto,
} from './dto/guardian-alert-setting.dto';
import {
  SeniorCheckinSettingResponseDto,
  UpdateSeniorCheckinSettingDto,
} from './dto/senior-checkin-setting.dto';
import { ProfileSettingsService } from './profile-settings.service';

@ApiTags('2. 내 계정 관리')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
@ApiForbiddenResponse({ type: ApiErrorResponseDto })
@UseGuards(AccessTokenGuard)
@Controller('users/me')
export class ProfileSettingsController {
  constructor(
    private readonly profileSettingsService: ProfileSettingsService,
  ) {}

  @Get('emotion-alert-settings')
  @ApiOperation({ summary: '보호자 알림 수신 여부와 정서지수 임계치 확인' })
  @ApiOkResponse({ type: GuardianAlertSettingResponseDto })
  getGuardianAlertSetting(@Req() request: AuthenticatedRequest) {
    return this.profileSettingsService.getGuardianAlertSetting(request.user);
  }

  @Patch('emotion-alert-settings')
  @ApiOperation({ summary: '보호자 알림 수신 여부 또는 정서지수 임계치 변경' })
  @ApiOkResponse({ type: GuardianAlertSettingResponseDto })
  updateGuardianAlertSetting(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateGuardianAlertSettingDto,
  ) {
    return this.profileSettingsService.updateGuardianAlertSetting(
      request.user,
      dto,
    );
  }

  @Get('checkin-reminder-settings')
  @ApiOperation({ summary: '시니어 안부 알림 수신 여부와 예약 시간 확인' })
  @ApiOkResponse({ type: SeniorCheckinSettingResponseDto })
  getSeniorCheckinSetting(@Req() request: AuthenticatedRequest) {
    return this.profileSettingsService.getSeniorCheckinSetting(request.user);
  }

  @Patch('checkin-reminder-settings')
  @ApiOperation({ summary: '시니어 안부 알림 수신 여부 또는 예약 시간 변경' })
  @ApiOkResponse({ type: SeniorCheckinSettingResponseDto })
  updateSeniorCheckinSetting(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateSeniorCheckinSettingDto,
  ) {
    return this.profileSettingsService.updateSeniorCheckinSetting(
      request.user,
      dto,
    );
  }
}
