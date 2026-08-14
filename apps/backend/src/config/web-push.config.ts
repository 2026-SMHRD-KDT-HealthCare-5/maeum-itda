/* 역할: 실제 Web Push 발송에 필요한 VAPID 환경변수를 하나의 설정 객체로 제공한다. */
import { registerAs } from '@nestjs/config';

export interface WebPushConfig {
  subject: string;
  publicKey: string;
  privateKey: string;
}

export default registerAs('webPush', (): WebPushConfig => ({
  subject: process.env.VAPID_SUBJECT ?? 'mailto:admin@maeum-itda.local',
  publicKey: process.env.VAPID_PUBLIC_KEY ?? '',
  privateKey: process.env.VAPID_PRIVATE_KEY ?? '',
}));
