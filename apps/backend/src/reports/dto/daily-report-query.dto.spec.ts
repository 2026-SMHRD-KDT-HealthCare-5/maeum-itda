/* 역할: 일간 리포트 조회 날짜가 정확한 YYYY-MM-DD 실제 날짜만 허용하는지 검증한다. */
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DailyReportQueryDto } from './daily-report-query.dto';

describe('DailyReportQueryDto', () => {
  const validateDate = (date: string) =>
    validate(plainToInstance(DailyReportQueryDto, { date }));

  it('유효한 날짜를 허용한다', async () => {
    await expect(validateDate('2026-08-14')).resolves.toHaveLength(0);
  });

  it.each(['2026/08/14', '2026-02-30', '2026-8-4'])(
    '잘못된 날짜 %s를 거부한다',
    async (date) => {
      expect(await validateDate(date)).not.toHaveLength(0);
    },
  );
});
