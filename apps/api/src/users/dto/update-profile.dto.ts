import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

import { TrimString } from '../../common/transformers';

/**
 * Bounds mirror the CHECK constraints on `users`, so a bad value is rejected
 * with a readable 400 before the database has to reject it with a 500-shaped
 * error. The constraints remain the actual guarantee.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Ada Lovelace' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @TrimString()
  name?: string;

  @ApiPropertyOptional({ example: 1500, minimum: 60, maximum: 14400 })
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(14400)
  focusDurationSec?: number;

  @ApiPropertyOptional({ example: 300, minimum: 60, maximum: 14400 })
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(14400)
  shortBreakSec?: number;

  @ApiPropertyOptional({ example: 900, minimum: 60, maximum: 14400 })
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(14400)
  longBreakSec?: number;

  @ApiPropertyOptional({ example: 4, minimum: 1, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  cyclesUntilLongBreak?: number;
}
