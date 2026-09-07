import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsTimeZone } from 'class-validator';

export class CycleQueryDto {
  @ApiPropertyOptional({
    example: 'America/Sao_Paulo',
    default: 'UTC',
    description:
      'IANA time zone deciding when the run of focus sessions restarts. Without it, an evening ' +
      'session would be counted against tomorrow.',
  })
  @IsOptional()
  @IsTimeZone()
  timeZone = 'UTC';
}
