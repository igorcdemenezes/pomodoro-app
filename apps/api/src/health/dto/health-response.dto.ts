import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'degraded'] })
  status!: 'ok' | 'degraded';

  @ApiProperty({
    example: 'up',
    enum: ['up', 'down'],
    description: 'Result of a SELECT 1 against the database',
  })
  database!: 'up' | 'down';

  @ApiProperty({ example: 42, description: 'Seconds since the process started' })
  uptimeSeconds!: number;

  @ApiProperty({ example: '2026-09-03T14:00:00.000Z' })
  timestamp!: string;
}
