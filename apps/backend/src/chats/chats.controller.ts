/*
역할: 시니어 과거 대화의 전체·날짜별 조회와 대화 날짜 달력 REST 요청을 받는다.
흐름: Bearer 인증 -> ChatsController -> ChatHistoryQueryService -> Repository -> MySQL
*/
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
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
import { ChatHistoryQueryService } from './chat-history-query.service';
import {
  ChatCalendarQueryDto,
  ChatCalendarResponseDto,
} from './dto/chat-calendar.dto';
import { ChatHistoryQueryDto } from './dto/chat-history-query.dto';
import { ChatHistoryPageResponseDto } from './dto/chat-history-response.dto';

@ApiTags('3. 대화 기록')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
@ApiForbiddenResponse({
  description: '시니어 계정이 아님',
  type: ApiErrorResponseDto,
})
@UseGuards(AccessTokenGuard)
@Controller('chats')
export class ChatsController {
  constructor(
    private readonly chatHistoryQueryService: ChatHistoryQueryService,
  ) {}

  @Get('messages')
  @ApiOperation({ summary: '시니어 전체·날짜별 과거 대화 cursor 조회' })
  @ApiOkResponse({ type: ChatHistoryPageResponseDto })
  @ApiBadRequestResponse({
    description: 'date, cursor 또는 limit 형식·범위 오류',
    type: ApiErrorResponseDto,
  })
  getMessages(
    @Req() request: AuthenticatedRequest,
    @Query() query: ChatHistoryQueryDto,
  ): Promise<ChatHistoryPageResponseDto> {
    return this.chatHistoryQueryService.getMessages(request.user, query);
  }

  @Get('calendar')
  @ApiOperation({ summary: '시니어 대화 존재 날짜 달력 조회' })
  @ApiOkResponse({ type: ChatCalendarResponseDto })
  @ApiBadRequestResponse({
    description: 'year 또는 month 형식·범위 오류',
    type: ApiErrorResponseDto,
  })
  getCalendar(
    @Req() request: AuthenticatedRequest,
    @Query() query: ChatCalendarQueryDto,
  ): Promise<ChatCalendarResponseDto> {
    return this.chatHistoryQueryService.getCalendar(
      request.user,
      query.year,
      query.month,
    );
  }
}
