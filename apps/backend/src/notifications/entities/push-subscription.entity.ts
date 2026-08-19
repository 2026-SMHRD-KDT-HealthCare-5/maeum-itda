/*
역할: 사용자 브라우저의 Web Push 구독 정보와 암호화 키를 PUSH_SUBSCRIPTION 테이블에 연결한다.
GUARDIAN_ID 컬럼명은 이 기능이 보호자 전용이던 시절의 이름이 남은 것 — 지금은 보호자/
시니어 구분 없이 "구독을 등록한 사용자"의 USER_ID를 그대로 담는다(실 스키마 변경은 별도
마이그레이션에서 처리하고, 여기선 TypeORM property 이름만 userId로 바꿔 코드를 정직하게 둔다).
*/
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'PUSH_SUBSCRIPTION' })
@Index('UK_PUSH_SUBSCRIPTION_ENDPOINT', ['endpoint'], { unique: true })
@Index('IX_PUSH_SUBSCRIPTION_GUARDIAN', ['userId', 'subscriptionId'])
export class PushSubscription {
  @PrimaryGeneratedColumn({ name: 'PUSH_SUBSCRIPTION_ID', type: 'int' })
  subscriptionId: number;

  @Column({ name: 'GUARDIAN_ID', type: 'int' })
  userId: number;

  @Column({ name: 'ENDPOINT', type: 'varchar', length: 2048 })
  endpoint: string;

  @Column({ name: 'P256DH_KEY', type: 'varchar', length: 255 })
  p256dhKey: string;

  @Column({ name: 'AUTH_SECRET', type: 'varchar', length: 255 })
  authSecret: string;

  @Column({
    name: 'EXPIRATION_TIME',
    type: 'bigint',
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value === null ? null : Number(value)),
    },
  })
  expirationTime: number | null;

  @Column({ name: 'USER_AGENT', type: 'varchar', length: 500, nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'datetime', precision: 3 })
  updatedAt: Date;
}
