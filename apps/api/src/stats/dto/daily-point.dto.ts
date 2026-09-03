import { ApiProperty } from '@nestjs/swagger';

export class DailyPointDto {
  @ApiProperty({ example: '2026-09-03', description: 'Calendar day in the requested time zone' })
  day!: string;

  @ApiProperty({ example: 4500 })
  focusedSeconds!: number;

  @ApiProperty({ example: 3 })
  completedSessions!: number;
}
