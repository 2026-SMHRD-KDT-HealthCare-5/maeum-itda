/*
역할: 사용자 관련 REST API 요청을 받는 입구다.
전체 흐름: 브라우저 → UsersController → UsersService → User Repository → MySQL
*/
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import type { AuthenticatedRequest } from '../auth/access-token.guard';
import { ApiErrorResponseDto } from '../common/dto/api-error-response.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

// /users 경로의 HTTP 요청을 이 Controller로 전달한다.
@ApiTags('2. 내 계정 관리')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('users')
export class UsersController {
  private readonly usersService: UsersService;

  // NestJS DI 컨테이너가 UsersService 객체를 생성자에 주입한다.
  constructor(usersService: UsersService) {
    this.usersService = usersService;
  }

  @Get('me')
  @ApiOperation({ summary: '내 정보 조회' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  getMyProfile(@Req() request: AuthenticatedRequest) {
    return this.usersService.getActiveProfile(request.user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: '내 기본 정보 수정' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  updateMyProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateMyProfileDto,
  ) {
    return this.usersService.updateActiveProfile(request.user.sub, dto);
  }

  @Delete('me')
  @HttpCode(204)
  @ApiOperation({ summary: '회원 탈퇴' })
  @ApiNoContentResponse({ description: '회원 탈퇴 완료' })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async withdraw(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.usersService.withdraw(request.user.sub);
  }
}
