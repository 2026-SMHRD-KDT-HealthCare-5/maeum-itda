/*
역할: 사용자 조회·저장 업무와 USERS 테이블 접근을 담당한다.
전체 흐름: AuthService 또는 UsersController → UsersService → Repository<User> → MySQL
*/
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';

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

  // 입력 데이터를 User Entity 객체로 만든 뒤 MySQL에 저장한다.
  create(data: {
    loginId: string;
    passwordHash: string;
    name: string;
    phone: string;
    role: UserRole;
  }): Promise<User> {
    // create()는 아직 SQL을 실행하지 않고 저장할 User 객체를 만든다.
    const user = this.usersRepository.create(data);

    // save()가 INSERT 또는 UPDATE SQL을 실행한다.
    return this.usersRepository.save(user);
  }
}
