import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { DailyPointDto } from './dto/daily-point.dto';
import type { ProjectBreakdownDto } from './dto/project-breakdown.dto';
import { StatsRange } from './dto/stats-query.dto';
import type { SummaryDto } from './dto/summary.dto';

/**
 * Productivity metrics, aggregated in SQL.
 *
 * Nothing here is computed by fetching rows and summing them in JavaScript: the
 * client must not be able to disagree with the server about how much focus time
 * a user has, and pulling a year of sessions over the wire to add them up would
 * be wrong twice over.
 *
 * "Focused time" is the time a session actually ran — the span between its start
 * and its end, minus whatever it spent paused — not its nominal duration. A
 * session finished early counts for what it was worth.
 */
const FOCUSED_SECONDS = Prisma.sql`
  GREATEST(
    0,
    EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) - (s.paused_accumulated_ms / 1000.0)
  )
`;

interface SummaryRow {
  focused_seconds: number;
  focused_seconds_today: number;
  completed_sessions: bigint;
  cancelled_sessions: bigint;
  tasks_completed: bigint;
}

interface DailyRow {
  day: string;
  focused_seconds: number;
  completed_sessions: bigint;
}

interface BreakdownRow {
  project_id: string;
  project_name: string;
  color: string;
  task_count: bigint;
  completed_task_count: bigint;
}

interface StreakRow {
  streak: bigint;
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(userId: string, range: StatsRange, timeZone: string): Promise<SummaryDto> {
    const since = this.rangeStart(range);

    const [row] = await this.prisma.$queryRaw<SummaryRow[]>`
      SELECT
        COALESCE(SUM(${FOCUSED_SECONDS}) FILTER (
          WHERE s.status = 'COMPLETED' AND s.kind = 'FOCUS'
        ), 0)::float8 AS focused_seconds,
        COALESCE(SUM(${FOCUSED_SECONDS}) FILTER (
          WHERE s.status = 'COMPLETED' AND s.kind = 'FOCUS'
            AND (s.started_at AT TIME ZONE ${timeZone})::date
                = (now() AT TIME ZONE ${timeZone})::date
        ), 0)::float8 AS focused_seconds_today,
        COUNT(*) FILTER (WHERE s.status = 'COMPLETED' AND s.kind = 'FOCUS') AS completed_sessions,
        COUNT(*) FILTER (WHERE s.status = 'CANCELLED' AND s.kind = 'FOCUS') AS cancelled_sessions,
        (
          SELECT COUNT(*) FROM tasks t
          WHERE t.user_id = ${userId}::uuid
            AND t.completed_at IS NOT NULL
            ${since ? Prisma.sql`AND t.completed_at >= ${since}` : Prisma.empty}
        ) AS tasks_completed
      FROM pomodoro_sessions s
      WHERE s.user_id = ${userId}::uuid
        ${since ? Prisma.sql`AND s.started_at >= ${since}` : Prisma.empty}
    `;

    const completed = Number(row.completed_sessions);
    const cancelled = Number(row.cancelled_sessions);
    const attempted = completed + cancelled;

    return {
      focusedSeconds: Math.round(row.focused_seconds),
      focusedSecondsToday: Math.round(row.focused_seconds_today),
      completedSessions: completed,
      cancelledSessions: cancelled,
      completionRate: attempted === 0 ? 0 : Number((completed / attempted).toFixed(4)),
      currentStreakDays: await this.currentStreak(userId, timeZone),
      tasksCompleted: Number(row.tasks_completed),
    };
  }

  /**
   * A point per calendar day, including days with no sessions.
   *
   * generate_series supplies the empty days, so the chart has no holes and the
   * client never has to invent the gaps. `from` and `to` are calendar days
   * already in `timeZone`, which only the sessions still need converting into.
   */
  async daily(
    userId: string,
    from: string,
    to: string,
    timeZone: string,
  ): Promise<DailyPointDto[]> {
    const rows = await this.prisma.$queryRaw<DailyRow[]>`
      SELECT
        to_char(d.day, 'YYYY-MM-DD') AS day,
        COALESCE(SUM(${FOCUSED_SECONDS}), 0)::float8 AS focused_seconds,
        COUNT(s.id) AS completed_sessions
      FROM generate_series(${from}::date, ${to}::date, interval '1 day') AS d(day)
      LEFT JOIN pomodoro_sessions s
        ON s.user_id = ${userId}::uuid
       AND s.status = 'COMPLETED'
       AND s.kind = 'FOCUS'
       AND (s.started_at AT TIME ZONE ${timeZone})::date = d.day::date
      GROUP BY d.day
      ORDER BY d.day
    `;

    return rows.map((row) => ({
      day: row.day,
      focusedSeconds: Math.round(row.focused_seconds),
      completedSessions: Number(row.completed_sessions),
    }));
  }

  /**
   * How far along each project is: tasks done over tasks in it.
   *
   * This is the project's state today, not a reading over a window, so there is
   * no range. Archived projects and projects with no tasks are left out — the
   * first are gone from the user's view, the second have no fraction to show.
   */
  async byProject(userId: string): Promise<ProjectBreakdownDto[]> {
    const rows = await this.prisma.$queryRaw<BreakdownRow[]>`
      SELECT
        p.id AS project_id,
        p.name AS project_name,
        p.color AS color,
        COUNT(t.id) AS task_count,
        COUNT(t.id) FILTER (WHERE t.status = 'DONE') AS completed_task_count
      FROM projects p
      JOIN tasks t ON t.project_id = p.id
      WHERE p.user_id = ${userId}::uuid
        AND p.archived_at IS NULL
      GROUP BY p.id, p.name, p.color
      ORDER BY (COUNT(t.id) FILTER (WHERE t.status = 'DONE'))::float8 / COUNT(t.id) DESC, p.name ASC
    `;

    return rows.map((row) => {
      const taskCount = Number(row.task_count);
      const completedTaskCount = Number(row.completed_task_count);

      return {
        projectId: row.project_id,
        projectName: row.project_name,
        color: row.color,
        taskCount,
        completedTaskCount,
        completionRate: Number((completedTaskCount / taskCount).toFixed(4)),
      };
    });
  }

  /**
   * Consecutive days, counting back from today, with at least one completed
   * focus session.
   *
   * The gap between a day and its row number is constant inside a run of
   * consecutive days, which turns "longest run ending today" into a grouping
   * rather than a loop over every day since the account was created.
   */
  private async currentStreak(userId: string, timeZone: string): Promise<number> {
    const [row] = await this.prisma.$queryRaw<StreakRow[]>`
      WITH active_days AS (
        SELECT DISTINCT (s.started_at AT TIME ZONE ${timeZone})::date AS day
        FROM pomodoro_sessions s
        WHERE s.user_id = ${userId}::uuid
          AND s.status = 'COMPLETED'
          AND s.kind = 'FOCUS'
      ),
      runs AS (
        SELECT day, day - (ROW_NUMBER() OVER (ORDER BY day))::int AS run_key
        FROM active_days
      ),
      current_run AS (
        SELECT run_key, COUNT(*) AS streak, MAX(day) AS last_day
        FROM runs
        GROUP BY run_key
      )
      SELECT COALESCE(MAX(streak), 0) AS streak
      FROM current_run
      -- A streak survives today being empty: it still counts up to yesterday.
      WHERE last_day >= (now() AT TIME ZONE ${timeZone})::date - 1
    `;

    return Number(row?.streak ?? 0);
  }

  private rangeStart(range: StatsRange): Date | null {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    switch (range) {
      case StatsRange.Week:
        return new Date(now - 7 * DAY);
      case StatsRange.Month:
        return new Date(now - 30 * DAY);
      case StatsRange.Year:
        return new Date(now - 365 * DAY);
      case StatsRange.All:
        return null;
    }
  }
}
