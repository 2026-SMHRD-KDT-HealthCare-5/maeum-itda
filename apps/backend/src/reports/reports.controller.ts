/*
역할: 일간·주간 리포트 REST 요청을 인증하고 조회 서비스로 전달한다.
전체 흐름: 브라우저 → AccessTokenGuard → ReportsController → 조회 Service → Repository → MySQL
*/
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
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
import { DailyReportQueryService } from './daily-report-query.service';
import { DailyReportQueryDto } from './dto/daily-report-query.dto';
import { DailyReportResponseDto } from './dto/daily-report-response.dto';
import { ReportCalendarQueryDto } from './dto/report-calendar-query.dto';
import { ReportCalendarResponseDto } from './dto/report-calendar-response.dto';
import { WeeklyReportQueryDto } from './dto/weekly-report-query.dto';
import { WeeklyReportResponseDto } from './dto/weekly-report-response.dto';
import { WeeklyReportQueryService } from './weekly-report-query.service';
import { ReportCalendarQueryService } from './report-calendar-query.service';

@ApiTags('5. 리포트')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly dailyReportQueryService: DailyReportQueryService,
    private readonly weeklyReportQueryService: WeeklyReportQueryService,
    private readonly reportCalendarQueryService: ReportCalendarQueryService,
  ) {}

  @Get('calendar')
  @ApiOperation({ summary: '보호자 일간·주간 리포트 통합 달력 조회' })
  @ApiOkResponse({ type: ReportCalendarResponseDto })
  @ApiBadRequestResponse({
    description: 'year 또는 month 형식·범위 오류',
    type: ApiErrorResponseDto,
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({
    description: '보호자 계정이 아님',
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: '연결된 시니어가 없음',
    type: ApiErrorResponseDto,
  })
  getReportCalendar(
    @Req() request: AuthenticatedRequest,
    @Query() query: ReportCalendarQueryDto,
  ): Promise<ReportCalendarResponseDto> {
    return this.reportCalendarQueryService.getCalendar(
      request.user,
      query.year,
      query.month,
    );
  }

  // 보호자 JWT의 연결 관계로 대상 시니어를 결정하므로 seniorId는 요청에서 받지 않는다.
  @Get('daily')
  @ApiOperation({ summary: '보호자 일간 정서 리포트 조회' })
  @ApiOkResponse({ type: DailyReportResponseDto })
  @ApiBadRequestResponse({
    description: 'date 형식 또는 실제 날짜가 올바르지 않음',
    type: ApiErrorResponseDto,
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({
    description: '보호자 계정이 아님',
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: '연결된 시니어 또는 해당 날짜 리포트가 없음',
    type: ApiErrorResponseDto,
  })
  getDailyReport(
    @Req() request: AuthenticatedRequest,
    @Query() query: DailyReportQueryDto,
  ): Promise<DailyReportResponseDto> {
    return this.dailyReportQueryService.getDailyReport(
      request.user,
      query.date,
    );
  }

  // 저장된 주간 결과와 해당 주의 월~일 일간 리포트를 화면용 응답으로 조합한다.
  @Get('weekly')
  @ApiOperation({ summary: '보호자 주간 정서 리포트 조회' })
  @ApiOkResponse({ type: WeeklyReportResponseDto })
  @ApiBadRequestResponse({
    description: 'weekStart 형식이 잘못되었거나 월요일이 아님',
    type: ApiErrorResponseDto,
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({
    description: '보호자 계정이 아님',
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: '연결된 시니어 또는 해당 주간 리포트가 없음',
    type: ApiErrorResponseDto,
  })
  getWeeklyReport(
    @Req() request: AuthenticatedRequest,
    @Query() query: WeeklyReportQueryDto,
  ): Promise<WeeklyReportResponseDto> {
    return this.weeklyReportQueryService.getWeeklyReport(
      request.user,
      query.weekStart,
    );
  }
}
