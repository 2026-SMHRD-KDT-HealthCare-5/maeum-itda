import type { DataSource } from 'typeorm';
import {
  configureUtcMysqlSessions,
  UTC_SESSION_SQL,
} from './database-timezone';

describe('configureUtcMysqlSessions', () => {
  it('현재 연결과 이후 생성되는 연결에 UTC 세션을 적용한다', async () => {
    interface TestConnection {
      query(sql: string, callback: (error: Error | null) => void): void;
      destroy(): void;
    }
    let connectionListener: ((connection: TestConnection) => void) | undefined;
    const poolOn = jest.fn(
      (
        _event: 'connection',
        listener: (connection: TestConnection) => void,
      ): void => {
        connectionListener = listener;
      },
    );
    const query = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ offsetMinutes: 0 }]);
    const dataSource = {
      options: { type: 'mysql' },
      driver: {
        pool: { on: poolOn },
      },
      query,
    } as unknown as DataSource;

    await configureUtcMysqlSessions(dataSource);

    expect(query).toHaveBeenNthCalledWith(1, UTC_SESSION_SQL);
    expect(connectionListener).toBeDefined();

    const connectionQuery = jest.fn(
      (_sql: string, callback: (error: Error | null) => void): void =>
        callback(null),
    );
    connectionListener?.({ query: connectionQuery, destroy: jest.fn() });
    expect(connectionQuery).toHaveBeenCalledWith(
      UTC_SESSION_SQL,
      expect.any(Function),
    );
  });

  it('UTC 적용 결과가 아니면 서버 시작을 중단한다', async () => {
    const dataSource = {
      options: { type: 'mysql' },
      driver: { pool: { on: jest.fn() } },
      query: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ offsetMinutes: 540 }]),
    } as unknown as DataSource;

    await expect(configureUtcMysqlSessions(dataSource)).rejects.toThrow(
      'MySQL 세션 시간대를 UTC로 설정하지 못했습니다.',
    );
  });
});
