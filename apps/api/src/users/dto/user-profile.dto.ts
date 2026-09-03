import { ApiProperty } from '@nestjs/swagger';

export class UserProfileDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'demo@pomodoro.app' })
  email!: string;

  @ApiProperty({ example: 'Demo User' })
  name!: string;

  @ApiProperty({ example: 1500, description: 'Default focus length in seconds' })
  focusDurationSec!: number;

  @ApiProperty({ example: 300 })
  shortBreakSec!: number;

  @ApiProperty({ example: 900 })
  longBreakSec!: number;

  @ApiProperty({ example: 4, description: 'Focus sessions before a long break' })
  cyclesUntilLongBreak!: number;

  @ApiProperty()
  createdAt!: Date;
}
