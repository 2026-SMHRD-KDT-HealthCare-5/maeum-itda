/*
역할: TypeORM이 사용하는 모든 MySQL 연결의 세션 시간대를 UTC로 고정한다.
전체 흐름: TypeORM 옵션 → DataSource 초기화 → 기존·신규 풀 연결에 SET time_zone 적용 → UTC 상태 검증
*/
import { DataSource, DataSourceOptions } from 'typeorm';

export const UTC_SESSION_SQL = "SET time_zone = '+00:00'";

interface MysqlSessionConnection {
  query(sql: string, callback: (error: Error | null) => void): void;
  destroy(): void;
}

interface MysqlConnectionPool {
  on(
    event: 'connection',
    listener: (connection: MysqlSessionConnection) => void,
  ): void;
}

interface MysqlDriverWithPool {
  pool?: MysqlConnectionPool;
}

/** NestJS가 완성한 TypeORM 옵션으로 DataSource를 만들고 UTC 세션 정책을 적용한다. */
export async function createUtcDataSource(
  options?: DataSourceOptions,
): Promise<DataSource> {
  if (!options) {
    throw new Error('TypeORM 데이터소스 옵션이 없습니다.');
  }

  const dataSource = await new DataSource(options).initialize();

  try {
    await configureUtcMysqlSessions(dataSource);
    return dataSource;
  } catch (error) {
    await dataSource.destroy();
    throw error;
  }
}

/**
 * 초기 연결과 이후 풀에 추가되는 연결 모두에 UTC 세션을 적용한다.
 * mysql2의 connection 이벤트에서 먼저 등록한 쿼리는 해당 연결의 후속 쿼리보다 앞서 실행된다.
 */
export async function configureUtcMysqlSessions(
  dataSource: DataSource,
): Promise<void> {
  if (dataSource.options.type !== 'mysql') {
    throw new Error(
      'UTC 세션 설정은 MySQL 데이터소스에서만 사용할 수 있습니다.',
    );
  }

  const pool = (dataSource.driver as unknown as MysqlDriverWithPool).pool;
  if (!pool) {
    throw new Error('MySQL 연결 풀을 찾을 수 없습니다.');
  }

  pool.on('connection', (connection) => {
    connection.query(UTC_SESSION_SQL, (error) => {
      // 시간대 설정에 실패한 연결로 데이터가 저장되면 혼합 시간 데이터가 다시 생길 수 있다.
      if (error) connection.destroy();
    });
  });

  // initialize() 과정에서 이미 생성된 첫 연결에도 동일한 설정을 적용한다.
  await dataSource.query(UTC_SESSION_SQL);
  const queryResult: unknown = await dataSource.query(
    'SELECT TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), NOW()) AS offsetMinutes',
  );
  const firstRow = Array.isArray(queryResult)
    ? (queryResult[0] as { offsetMinutes?: unknown } | undefined)
    : undefined;

  if (Number(firstRow?.offsetMinutes) !== 0) {
    throw new Error('MySQL 세션 시간대를 UTC로 설정하지 못했습니다.');
  }
}
