import { WebSocketGateway } from '@nestjs/websockets';
import { ChatsService } from './chats.service';

@WebSocketGateway({
  path: '/ws/chats',
})
export class ChatsGateway {
  constructor(private readonly chatsService: ChatsService) {}
}
