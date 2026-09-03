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
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - 13 * DAY_MS);

    if (from.getTime() > to.getTime()) {
      throw new BadRequestException({
        code: 'INVALID_RANGE',
        message: '`from` must not be after `to`.',
      });
    }

    // A bounded span keeps one request from asking the database to generate an
    // unbounded series.
    if (to.getTime() - from.getTime() > MAX_DAILY_SPAN_DAYS * DAY_MS) {
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
