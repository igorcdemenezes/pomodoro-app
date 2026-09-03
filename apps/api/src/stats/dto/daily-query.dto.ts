import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsTimeZone } from 'class-validator';

export class DailyQueryDto {
  @ApiPropertyOptional({ example: '2026-08-04', description: 'Defaults to 13 days ago' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-03', description: 'Defaults to today' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ example: 'America/Sao_Paulo', default: 'UTC' })
  @IsOptional()
  @IsTimeZone()
  timeZone = 'UTC';
}
