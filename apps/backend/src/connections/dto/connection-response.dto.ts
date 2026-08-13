/* 역할: 연결 요청·상태 조회 응답을 Swagger와 프론트 생성 타입에 명시한다. */
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../users/entities/user.entity';
import { ConnectionStatus } from '../../users/entities/guardian-senior-relationship.entity';

export class ConnectionCounterpartResponseDto {
  @ApiProperty({ example: 2 })
  userId!: number;

  @ApiProperty({ example: 'guardian01' })
  loginId!: string;

  @ApiProperty({ example: '김민준' })
  name!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.GUARDIAN })
  role!: UserRole;
}

export class ConnectionResponseDto {
  @ApiProperty({ nullable: true, example: 10 })
  relationshipId!: number | null;

  @ApiProperty({
    enum: ConnectionStatus,
    nullable: true,
    example: ConnectionStatus.CONNECTED,
  })
  status!: ConnectionStatus | null;

  @ApiProperty({ format: 'date-time', nullable: true })
  requestedAt!: Date | null;

  @ApiProperty({ format: 'date-time', nullable: true })
  connectedAt!: Date | null;

  @ApiProperty({ type: ConnectionCounterpartResponseDto, nullable: true })
  counterpart!: ConnectionCounterpartResponseDto | null;
}
