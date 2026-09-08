import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { DailyPointDto } from './dto/daily-point.dto';
import { DailyQueryDto } from './dto/daily-query.dto';
import { ProjectBreakdownDto } from './dto/project-breakdown.dto';
import { StatsQueryDto } from './dto/stats-query.dto';
import { SummaryDto } from './dto/summary.dto';
import { StatsService } from './stats.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAILY_SPAN_DAYS = 366;

@ApiTags('stats')
@ApiBearerAuth('access-token')
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Headline productivity figures',
    description: 'Aggregated in SQL; the client never sums sessions to produce a metric.',
  })
  @ApiOkResponse({ type: SummaryDto })
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: StatsQueryDto,
  ): Promise<SummaryDto> {
    return this.stats.summary(user.id, query.range, query.timeZone);
  }

  @Get('daily')
  @ApiOperation({
    summary: 'Focused time per calendar day',
    description: 'Days with no sessions are returned as zeros, so a chart has no holes.',
  })
  @ApiOkResponse({ type: [DailyPointDto] })
  daily(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DailyQueryDto,
  ): Promise<DailyPointDto[]> {
    // Both bounds are calendar days in the caller's zone, so they never pass
    // through a `Date`: an instant has no idea which day it is until told
    // where, and the wrong answer here loses today for everyone west of UTC.
    const to = query.to ?? calendarDay(new Date(), query.timeZone);
    const from = query.from ?? daysBefore(to, 13);

    if (from > to) {
      throw new BadRequestException({
        code: 'INVALID_RANGE',
        message: '`from` must not be after `to`.',
      });
    }

    // A bounded span keeps one request from asking the database to generate an
    // unbounded series.
    if (dayMs(to) - dayMs(from) > MAX_DAILY_SPAN_DAYS * DAY_MS) {
      throw new BadRequestException({
        code: 'RANGE_TOO_WIDE',
        message: `The range must not exceed ${MAX_DAILY_SPAN_DAYS} days.`,
      });
    }

    return this.stats.daily(user.id, from, to, query.timeZone);
  }

  @Get('by-project')
  @ApiOperation({
    summary: 'Focused time per project',
    description: 'Sessions with no project are returned as their own bucket.',
  })
  @ApiOkResponse({ type: [ProjectBreakdownDto] })
  byProject(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: StatsQueryDto,
  ): Promise<ProjectBreakdownDto[]> {
    return this.stats.byProject(user.id, query.range);
  }
}

/** The calendar day an instant falls on in `timeZone`, as YYYY-MM-DD. */
function calendarDay(instant: Date, timeZone: string): string {
  // en-CA is the locale whose short date is already ISO order.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** Calendar arithmetic on the day alone; midnight UTC is only a scratch instant. */
function dayMs(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

function daysBefore(day: string, days: number): string {
  return new Date(dayMs(day) - days * DAY_MS).toISOString().slice(0, 10);
}
