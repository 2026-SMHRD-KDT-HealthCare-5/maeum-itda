/*
역할: 보호자-시니어 연결 요청·응답·해제 REST API의 인증된 진입점을 제공한다.
전체 흐름: 브라우저 → AccessTokenGuard → ConnectionsController → ConnectionsService → MySQL
*/
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import type { AuthenticatedRequest } from '../auth/access-token.guard';
import { ApiErrorResponseDto } from '../common/dto/api-error-response.dto';
import { ConnectionResponseDto } from './dto/connection-response.dto';
import { CreateConnectionRequestDto } from './dto/create-connection-request.dto';
import { ConnectionsService } from './connections.service';

@ApiTags('5. 보호자-시니어 연결')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
@UseGuards(AccessTokenGuard)
@Controller('connections')
export class ConnectionsController {
  constructor(private readonly connectionsService: ConnectionsService) {}

  @Get('me')
  @ApiOperation({ summary: '초기 연결 상태 조회' })
  @ApiOkResponse({ type: ConnectionResponseDto })
  getMyConnection(@Req() request: AuthenticatedRequest) {
    return this.connectionsService.getMyConnection(request.user);
  }

  @Post('requests')
  @ApiOperation({ summary: '보호자가 시니어에게 연결 요청' })
  @ApiCreatedResponse({ type: ConnectionResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  createRequest(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateConnectionRequestDto,
  ) {
    return this.connectionsService.createRequest(request.user, dto);
  }

  @Post('requests/:relationshipId/accept')
  @HttpCode(200)
  @ApiOperation({ summary: '시니어가 연결 요청 수락' })
  @ApiOkResponse({ type: ConnectionResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  acceptRequest(
    @Req() request: AuthenticatedRequest,
    @Param('relationshipId', ParseIntPipe) relationshipId: number,
  ) {
    return this.connectionsService.acceptRequest(request.user, relationshipId);
  }

  @Post('requests/:relationshipId/reject')
  @HttpCode(204)
  @ApiOperation({ summary: '시니어가 연결 요청 거절' })
  @ApiNoContentResponse({ description: '연결 요청 거절 완료' })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async rejectRequest(
    @Req() request: AuthenticatedRequest,
    @Param('relationshipId', ParseIntPipe) relationshipId: number,
  ): Promise<void> {
    await this.connectionsService.rejectRequest(request.user, relationshipId);
  }

  @Delete('requests/:relationshipId')
  @HttpCode(204)
  @ApiOperation({ summary: '보호자가 보낸 연결 요청 취소' })
  @ApiNoContentResponse({ description: '연결 요청 취소 완료' })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async cancelRequest(
    @Req() request: AuthenticatedRequest,
    @Param('relationshipId', ParseIntPipe) relationshipId: number,
  ): Promise<void> {
    await this.connectionsService.cancelRequest(request.user, relationshipId);
  }

  @Delete('me')
  @HttpCode(204)
  @ApiOperation({ summary: '현재 보호자-시니어 연결 해제' })
  @ApiNoContentResponse({ description: '연결 해제 완료' })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async disconnect(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.connectionsService.disconnect(request.user);
  }
}
