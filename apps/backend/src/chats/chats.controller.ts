/*
역할: 과거 대화 조회처럼 WebSocket이 아닌 채팅 REST API 요청을 받는 입구다.
전체 흐름: 브라우저 → ChatsController → ChatsService → Repository → MySQL
*/
import { Controller } from '@nestjs/common';
import { ChatsService } from './chats.service';

// /chats 경로의 HTTP 요청을 이 Controller로 전달한다.
@Controller('chats')
export class ChatsController {
  private readonly chatsService: ChatsService;

  // NestJS DI 컨테이너가 ChatsService 객체를 생성자에 주입한다.
  constructor(chatsService: ChatsService) {
    this.chatsService = chatsService;
  }

  // 과거 메시지 무한 스크롤용 cursor 기반 REST API 메서드는 이후 이 클래스에 추가한다.
}
