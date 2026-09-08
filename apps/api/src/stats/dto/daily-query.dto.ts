import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsTimeZone, Matches } from 'class-validator';

/**
 * A calendar day, not an instant: `2026-09-07` means the 7th wherever the user
 * is. Parsed as a `Date` it would become midnight UTC, which is still the 6th
 * anywhere west of Greenwich — and the whole series would shift back a day.
 */
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

export class DailyQueryDto {
  @ApiPropertyOptional({
    example: '2026-08-04',
    description: 'Calendar day (YYYY-MM-DD) in `timeZone`. Defaults to 13 days before `to`',
  })
  @IsOptional()
  @Matches(CALENDAR_DAY, { message: 'from must be a calendar day (YYYY-MM-DD)' })
  @IsDateString({ strict: true })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-09-03',
    description: 'Calendar day (YYYY-MM-DD) in `timeZone`. Defaults to today there',
  })
  @IsOptional()
  @Matches(CALENDAR_DAY, { message: 'to must be a calendar day (YYYY-MM-DD)' })
  @IsDateString({ strict: true })
  to?: string;

  @ApiPropertyOptional({ example: 'America/Sao_Paulo', default: 'UTC' })
  @IsOptional()
  @IsTimeZone()
  timeZone = 'UTC';
}
