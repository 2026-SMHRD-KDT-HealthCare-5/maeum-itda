/* 역할: 인증된 보호자에게 홈 화면 통합 조회 API와 Swagger 계약을 제공한다. */
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import type { AuthenticatedRequest } from '../auth/access-token.guard';
import { ApiErrorResponseDto } from '../common/dto/api-error-response.dto';
import { GuardianDashboardResponseDto } from './dto/guardian-dashboard-response.dto';
import { GuardianDashboardService } from './guardian-dashboard.service';

@ApiTags('8. 보호자 대시보드')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('guardian/dashboard')
export class GuardianDashboardController {
  constructor(private readonly dashboardService: GuardianDashboardService) {}

  @Get()
  @ApiOperation({ summary: '보호자 홈 대시보드 통합 조회' })
  @ApiOkResponse({ type: GuardianDashboardResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({
    description: '보호자 계정이 아님',
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: '연결된 시니어가 없음',
    type: ApiErrorResponseDto,
  })
  getDashboard(
    @Req() request: AuthenticatedRequest,
  ): Promise<GuardianDashboardResponseDto> {
    return this.dashboardService.getDashboard(request.user);
  }
}
