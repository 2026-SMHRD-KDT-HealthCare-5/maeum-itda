/*
역할: 환경변수를 TypeORM MySQL 연결 설정 객체로 변환한다.
전체 흐름: .env → ConfigModule → database.config.ts → TypeOrmModule → MySQL
*/
import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

// database라는 이름으로 설정을 등록해 ConfigService에서 조회할 수 있게 한다.
export default registerAs('database', (): TypeOrmModuleOptions => ({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  charset: 'utf8mb4',
  // JS Date와 MySQL DATETIME 사이 변환 기준을 UTC로 고정한다.
  // DB 세션의 NOW()/CURRENT_TIMESTAMP 기준은 database-timezone.ts에서 별도로 UTC로 맞춘다.
  timezone: 'Z',
  autoLoadEntities: true,

  // 기존 테이블을 Entity 기준으로 자동 변경하지 않도록 비활성화한다.
  synchronize: false,

  logging: true,
}));
