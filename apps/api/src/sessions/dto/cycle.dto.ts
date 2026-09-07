import { ApiProperty } from '@nestjs/swagger';

export class CycleDto {
  @ApiProperty({
    example: 2,
    description:
      'Focus sessions completed since the current run began. The run restarts at the last ' +
      'completed long break, and at local midnight.',
  })
  completedInCycle!: number;

  @ApiProperty({ example: 4, description: 'How many focus sessions a long break is owed after' })
  cyclesUntilLongBreak!: number;
}
