/* 역할: 연결 요청의 시니어 아이디가 회원가입과 동일한 형식인지 검증한다. */
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateConnectionRequestDto } from './create-connection-request.dto';

describe('CreateConnectionRequestDto', () => {
  it('영문·숫자 4~20자 시니어 아이디를 허용한다', async () => {
    const dto = plainToInstance(CreateConnectionRequestDto, {
      seniorLoginId: 'senior01',
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each(['abc', 'senior_01', '가나다라', 'a'.repeat(21)])(
    '올바르지 않은 시니어 아이디 %s를 거절한다',
    async (seniorLoginId) => {
      const dto = plainToInstance(CreateConnectionRequestDto, {
        seniorLoginId,
      });
      await expect(validate(dto)).resolves.not.toHaveLength(0);
    },
  );
});
