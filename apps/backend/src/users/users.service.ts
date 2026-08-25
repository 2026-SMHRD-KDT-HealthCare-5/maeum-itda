/*
역할: 사용자 조회·저장 업무와 USERS 테이블 접근을 담당한다.
전체 흐름: AuthService 또는 UsersController → UsersService → Repository<User> → MySQL
*/
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { normalizePhoneNumber } from './phone-number';

// NestJS가 UsersService를 Provider 객체로 생성·주입할 수 있게 한다.
@Injectable()
export class UsersService {
  private readonly usersRepository: Repository<User>;

  // TypeOrmModule이 생성한 User 전용 Repository 객체를 주입받는다.
  constructor(
    @InjectRepository(User)
    usersRepository: Repository<User>,
  ) {
    this.usersRepository = usersRepository;
  }

  // loginId 조건을 TypeORM 조회 명령으로 전달하고 조회 결과를 반환한다.
  findByLoginId(loginId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { loginId } });
  }

  findById(userId: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { userId } });
  }

  async getActiveProfile(userId: number) {
    const user = await this.getActiveUserOrThrow(userId);
    return this.toPublicUser(user);
  }

  async updateActiveProfile(
    userId: number,
    data: { name?: string; phone?: string },
  ) {
    const user = await this.getActiveUserOrThrow(userId);
    Object.assign(user, {
      ...data,
      ...(data.phone === undefined
        ? {}
        : { phone: normalizePhoneNumber(data.phone) as string }),
    });
    return this.toPublicUser(await this.usersRepository.save(user));
  }

  async withdraw(userId: number): Promise<void> {
    const user = await this.getActiveUserOrThrow(userId);
    user.withdrawnAt = new Date();
    await this.usersRepository.save(user);
  }

  // 입력 데이터를 User Entity 객체로 만든 뒤 MySQL에 저장한다.
  create(data: {
    loginId: string;
    passwordHash: string;
    name: string;
    phone: string;
    role: UserRole;
  }): Promise<User> {
    // create()는 아직 SQL을 실행하지 않고 저장할 User 객체를 만든다.
    // notificationEnabled는 DB 컬럼 기본값에 기대지 않고 여기서 명시적으로
    // true를 채운다 — 온보딩 권한 거절/마이페이지 토글 오프 때만 false가 되고
    // 그 외엔 항상 켜짐이어야 하는 정책이라, 컬럼 기본값(schema.sql)이 나중에
    // 어긋나도 가입 흐름 자체는 이 값에 영향받지 않게 한다.
    const user = this.usersRepository.create({
      ...data,
      phone: normalizePhoneNumber(data.phone) as string,
      notificationEnabled: true,
    });

    // save()가 INSERT 또는 UPDATE SQL을 실행한다.
    return this.usersRepository.save(user);
  }

  private async getActiveUserOrThrow(userId: number): Promise<User> {
    const user = await this.findById(userId);
    if (!user || user.withdrawnAt !== null) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }
    return user;
  }

  private toPublicUser(user: User) {
    return {
      userId: user.userId,
      loginId: user.loginId,
      name: user.name,
      phone: user.phone,
      role: user.role,
      joinedAt: user.joinedAt,
    };
  }
}
