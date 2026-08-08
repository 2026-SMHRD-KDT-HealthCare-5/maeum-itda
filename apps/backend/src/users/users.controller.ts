/*
역할: 사용자 관련 REST API 요청을 받는 입구다.
전체 흐름: 브라우저 → UsersController → UsersService → User Repository → MySQL
*/
import { Controller } from '@nestjs/common';
import { UsersService } from './users.service';

// /users 경로의 HTTP 요청을 이 Controller로 전달한다.
@Controller('users')
export class UsersController {
  private readonly usersService: UsersService;

  // NestJS DI 컨테이너가 UsersService 객체를 생성자에 주입한다.
  constructor(usersService: UsersService) {
    this.usersService = usersService;
  }
}
