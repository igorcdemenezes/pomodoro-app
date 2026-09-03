import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SessionKind } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class StartSessionDto {
  @ApiProperty({ enum: SessionKind })
  @IsEnum(SessionKind)
  kind!: SessionKind;

  @ApiPropertyOptional({ format: 'uuid', description: 'Focus sessions may be attached to a task' })
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @ApiPropertyOptional({
    example: 1500,
    minimum: 60,
    maximum: 14400,
    description: "Defaults to the user's preference for this kind of session",
  })
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(14400)
  durationSec?: number;

  @ApiProperty({
    format: 'uuid',
    description:
      'Client-generated idempotency key. Retrying a start request after a dropped connection ' +
      'resolves to the same session instead of creating a second one.',
  })
  @IsUUID()
  clientMutationId!: string;
}
