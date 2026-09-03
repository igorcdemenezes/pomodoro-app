import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: 'ok';

  @ApiProperty({ example: 42, description: 'Seconds since the process started' })
  uptimeSeconds!: number;

  @ApiProperty({ example: '2026-09-03T14:00:00.000Z' })
  timestamp!: string;
}
