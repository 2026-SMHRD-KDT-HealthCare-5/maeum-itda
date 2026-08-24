/*
역할: User 객체와 MySQL USERS 테이블의 컬럼·제약조건을 연결한다.
전체 흐름: UsersService → Repository<User> → User Entity → USERS 테이블
*/
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum UserRole {
  SENIOR = 'SENIOR',
  GUARDIAN = 'GUARDIAN',
}

// TypeORM이 아래 클래스와 속성을 USERS 테이블 및 컬럼에 대응시킨다.
@Entity({ name: 'USERS' })
@Index('UK_USERS_LOGIN_ID', ['loginId'], { unique: true })
@Check(
  'CK_USERS_WITHDRAWN_AT',
  'WITHDRAWN_AT IS NULL OR WITHDRAWN_AT >= JOINED_AT',
)
export class User {
  @PrimaryGeneratedColumn({ name: 'USER_ID', type: 'int' })
  userId: number;

  @Column({ name: 'LOGIN_ID', type: 'varchar', length: 50 })
  loginId: string;

  @Column({ name: 'PASSWORD_HASH', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ name: 'NAME', type: 'varchar', length: 50 })
  name: string;

  @Column({ name: 'PHONE', type: 'varchar', length: 20 })
  phone: string;

  @Column({ name: 'ROLE', type: 'enum', enum: UserRole })
  role: UserRole;

  // "알림 켜짐" 여부는 사용자가 직접 설정한 값 그대로여야 한다 — 기기의 웹 푸시
  // 구독 성립 여부와는 별개다(구독은 이 값이 true일 때 내부적으로만 관리되는
  // 전달 수단일 뿐, 화면에 노출되는 토글은 이 값이다). 같은 브라우저에서 여러
  // 계정을 번갈아 테스트하면 브라우저(origin) 단위로 구독이 하나뿐이라 한
  // 계정이 구독을 해지하면 다른 계정도 "구독 없음"처럼 보이는데, 이 값을 구독
  // 존재로부터 유도하면 그 혼선이 그대로 켜짐/꺼짐에 새어든다 — 그래서 독립된
  // 플래그로 둔다. default는 false다 — true였을 때 가입만 해도 구독 없이
  // "켜짐"으로 보이는 문제가 있었다(실 DB 확인: 37명 중 30명이 구독 0건인데
  // 켜짐 상태). 물리 컬럼 기본값은 database/schema.sql에서 함께 바꾼다.
  @Column({ name: 'NOTIFICATION_ENABLED', type: 'boolean', default: false })
  notificationEnabled!: boolean;

  @Column({
    name: 'EMOTION_ALERT_THRESHOLD',
    type: 'tinyint',
    unsigned: true,
    nullable: true,
  })
  emotionAlertThreshold!: number | null;

  @Column({ name: 'CHECKIN_REMINDER_TIME', type: 'time', nullable: true })
  checkinReminderTime!: string | null;

  @CreateDateColumn({ name: 'JOINED_AT', type: 'datetime' })
  joinedAt: Date;

  @Column({ name: 'WITHDRAWN_AT', type: 'datetime', nullable: true })
  withdrawnAt: Date | null;
}
