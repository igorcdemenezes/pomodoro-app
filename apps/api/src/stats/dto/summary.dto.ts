import { ApiProperty } from '@nestjs/swagger';

export class SummaryDto {
  @ApiProperty({ example: 9300, description: 'Focused seconds in the range, excluding pauses' })
  focusedSeconds!: number;

  @ApiProperty({ example: 1500, description: 'Focused seconds today, in the requested time zone' })
  focusedSecondsToday!: number;

  @ApiProperty({ example: 12, description: 'Focus sessions completed' })
  completedSessions!: number;

  @ApiProperty({ example: 3, description: 'Focus sessions abandoned' })
  cancelledSessions!: number;

  @ApiProperty({
    example: 0.8,
    description: 'Completed over completed plus cancelled; 0 when none',
  })
  completionRate!: number;

  @ApiProperty({
    example: 5,
    description: 'Consecutive days ending today with a completed session',
  })
  currentStreakDays!: number;

  @ApiProperty({ example: 4, description: 'Tasks marked done in the range' })
  tasksCompleted!: number;
}
