import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsTimeZone } from 'class-validator';

export enum StatsRange {
  Week = 'week',
  Month = 'month',
  Year = 'year',
  All = 'all',
}

export class StatsQueryDto {
  @ApiPropertyOptional({ enum: StatsRange, default: StatsRange.Week })
  @IsOptional()
  @IsEnum(StatsRange)
  range: StatsRange = StatsRange.Week;

  @ApiPropertyOptional({
    example: 'America/Sao_Paulo',
    default: 'UTC',
    description:
      'IANA time zone used to decide which day a session belongs to. Without it, a session ' +
      'at 22:00 local time would be counted on the following day.',
  })
  @IsOptional()
  @IsTimeZone()
  timeZone = 'UTC';
}
