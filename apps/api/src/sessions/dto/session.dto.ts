import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SessionKind, SessionStatus } from '@prisma/client';

export class SessionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  taskId!: string | null;

  @ApiProperty({ enum: SessionKind })
  kind!: SessionKind;

  @ApiProperty({ enum: SessionStatus })
  status!: SessionStatus;

  @ApiProperty()
  startedAt!: Date;

  @ApiProperty({ example: 1500 })
  durationSec!: number;

  @ApiPropertyOptional({ nullable: true })
  endedAt!: Date | null;

  @ApiProperty({ example: 620, description: 'Seconds actually run, excluding pauses' })
  elapsedSec!: number;

  @ApiProperty({ example: 880, description: 'Seconds left; the client counts down from this' })
  remainingSec!: number;

  @ApiPropertyOptional({
    nullable: true,
    description: 'When the session is due to finish. Null while paused, since the clock is frozen.',
  })
  dueAt!: Date | null;

  @ApiProperty({
    description:
      "The server's current instant. Clients compare it with their own clock and apply the " +
      'difference, so a device with the wrong time still counts down correctly.',
  })
  serverTime!: Date;
}
