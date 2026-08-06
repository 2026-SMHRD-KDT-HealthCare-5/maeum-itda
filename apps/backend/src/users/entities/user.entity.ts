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

  @CreateDateColumn({ name: 'JOINED_AT', type: 'datetime' })
  joinedAt: Date;

  @Column({ name: 'WITHDRAWN_AT', type: 'datetime', nullable: true })
  withdrawnAt: Date | null;
}
