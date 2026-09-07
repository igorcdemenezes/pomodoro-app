import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SessionKind, SessionStatus } from '@prisma/client';
import type { PomodoroSession, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { CycleDto } from './dto/cycle.dto';
import type { SessionDto } from './dto/session.dto';
import type { SessionPageDto } from './dto/session-page.dto';
import type { StartSessionDto } from './dto/start-session.dto';
import { toSessionDto } from './session.mapper';
import { hasExpired, pauseAccumulationOnResume } from './session-timing';

const ACTIVE_STATUSES = [SessionStatus.RUNNING, SessionStatus.PAUSED];

interface CycleRow {
  cycles_until_long_break: number;
  completed_in_cycle: bigint;
}

export interface HistoryQuery {
  from?: Date;
  to?: Date;
  cursor?: string;
  limit: number;
}

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Starts a session, or returns the one an earlier attempt already created.
   *
   * Three guarantees stack here. The client mutation id makes a retry after a
   * dropped connection idempotent. The service refuses to start while another
   * session is active. And the partial unique index refuses it again at the
   * database, which is what holds when two devices race and both pass the
   * service check.
   */
  async start(userId: string, dto: StartSessionDto): Promise<SessionDto> {
    const now = new Date();

    const replay = await this.prisma.pomodoroSession.findUnique({
      where: { clientMutationId: dto.clientMutationId },
    });

    if (replay) {
      if (replay.userId !== userId) {
        throw new ConflictException({
          code: 'DUPLICATE_MUTATION',
          message: 'This request was already processed.',
        });
      }

      return toSessionDto(replay, now);
    }

    if (dto.taskId) await this.requireOwnedTask(userId, dto.taskId);

    const durationSec = dto.durationSec ?? (await this.defaultDuration(userId, dto.kind));

    const session = await this.prisma.$transaction(async (tx) => {
      // A session whose deadline passed while the app was closed still occupies
      // the slot. Settle it first, inside the same transaction, so starting the
      // next one is not blocked by a session that is over in every sense but
      // the row.
      await this.settleExpired(tx, userId, now);

      const active = await tx.pomodoroSession.findFirst({
        where: { userId, status: { in: ACTIVE_STATUSES } },
      });

      if (active) {
        throw new ConflictException({
          code: 'SESSION_ALREADY_ACTIVE',
          message: 'You already have a session in progress.',
          details: { activeSessionId: active.id },
        });
      }

      return tx.pomodoroSession.create({
        data: {
          userId,
          taskId: dto.taskId ?? null,
          kind: dto.kind,
          status: SessionStatus.RUNNING,
          startedAt: now,
          durationSec,
          clientMutationId: dto.clientMutationId,
        },
      });
    });

    return toSessionDto(session, now);
  }

  /** The session the client should be rendering, or null when there is none. */
  async findActive(userId: string): Promise<SessionDto | null> {
    const now = new Date();

    await this.prisma.$transaction((tx) => this.settleExpired(tx, userId, now));

    const active = await this.prisma.pomodoroSession.findFirst({
      where: { userId, status: { in: ACTIVE_STATUSES } },
    });

    return active ? toSessionDto(active, now) : null;
  }

  /**
   * Where the user stands in the run of focus sessions that ends in a long break.
   *
   * Counted in SQL from what is recorded rather than tracked on a device: the
   * position has to survive the app being closed mid-cycle, and two devices must
   * not be able to disagree about which Pomodoro this is.
   *
   * The run restarts at the last completed long break — which is what a long
   * break is — and again at local midnight, so a cycle abandoned yesterday does
   * not leave today starting at three. It also restarts where the user said so
   * (`resetCycle`): a run they lost track of is theirs to start over.
   *
   * A cancelled session is not a boundary. The Pomodoro it interrupted is void
   * — it earns no place in the run, exactly as it earns no time in the
   * statistics — but the ones already banked are not taken away with it: the
   * run measures accumulated fatigue, and an interruption does not undo the two
   * hours of work that came before it. Punishing the honest signal would only
   * teach the user to let the timer run out in a pocket instead.
   *
   * A session belongs to the run it *ended* in, not the one it started in. The
   * daily chart buckets by `started_at`, because a day is described by when its
   * work began; the run cannot, because a Pomodoro that began at 23:48 and
   * finished at 00:13 has to move the row the moment it lands. Bucketing it by
   * its start would drop the session the user just watched complete.
   */
  async cycle(userId: string, timeZone: string): Promise<CycleDto> {
    const [row] = await this.prisma.$queryRaw<CycleRow[]>`
      SELECT
        u.cycles_until_long_break AS cycles_until_long_break,
        (
          SELECT COUNT(*)
          FROM pomodoro_sessions s
          WHERE s.user_id = u.id
            AND s.status = 'COMPLETED'
            AND s.kind = 'FOCUS'
            AND s.ended_at >= GREATEST(
              date_trunc('day', now() AT TIME ZONE ${timeZone}) AT TIME ZONE ${timeZone},
              COALESCE(u.cycle_reset_at, '-infinity'::timestamptz),
              COALESCE(
                (
                  SELECT MAX(l.ended_at)
                  FROM pomodoro_sessions l
                  WHERE l.user_id = u.id
                    AND l.status = 'COMPLETED'
                    AND l.kind = 'LONG_BREAK'
                ),
                '-infinity'::timestamptz
              )
            )
        ) AS completed_in_cycle
      FROM users u
      WHERE u.id = ${userId}::uuid
    `;

    if (!row) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found.' });
    }

    return {
      completedInCycle: Number(row.completed_in_cycle),
      cyclesUntilLongBreak: row.cycles_until_long_break,
    };
  }

  /**
   * Starts the run over from where the user is now.
   *
   * A boundary, not an erasure: the Pomodoros done so far keep their place in
   * the statistics and in the history, and only stop counting toward the long
   * break. Recorded as an instant rather than by touching sessions, so a focus
   * that is running through the reset becomes the first of the new run when it
   * finishes, and the other device sees the same run on its next fetch.
   */
  async resetCycle(userId: string, timeZone: string): Promise<CycleDto> {
    const updated = await this.prisma.user.updateMany({
      where: { id: userId },
      data: { cycleResetAt: new Date() },
    });

    if (updated.count === 0) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found.' });
    }

    return this.cycle(userId, timeZone);
  }

  async pause(userId: string, id: string): Promise<SessionDto> {
    const now = new Date();
    const session = await this.requireOwned(userId, id);

    this.requireStatus(session, [SessionStatus.RUNNING], 'pause');

    if (hasExpired(session, now)) {
      return this.applyUpdate(
        id,
        { status: SessionStatus.COMPLETED, pausedAt: null, endedAt: now },
        now,
      );
    }

    return this.applyUpdate(id, { status: SessionStatus.PAUSED, pausedAt: now }, now);
  }

  async resume(userId: string, id: string): Promise<SessionDto> {
    const now = new Date();
    const session = await this.requireOwned(userId, id);

    this.requireStatus(session, [SessionStatus.PAUSED], 'resume');

    return this.applyUpdate(
      id,
      {
        status: SessionStatus.RUNNING,
        pausedAt: null,
        pausedAccumulatedMs: pauseAccumulationOnResume(session, now),
      },
      now,
    );
  }

  async finish(userId: string, id: string, status: SessionStatus): Promise<SessionDto> {
    const now = new Date();
    const session = await this.requireOwned(userId, id);

    this.requireStatus(
      session,
      ACTIVE_STATUSES,
      status === SessionStatus.COMPLETED ? 'complete' : 'cancel',
    );

    return this.applyUpdate(id, { status, pausedAt: null, endedAt: now }, now);
  }

  async history(userId: string, query: HistoryQuery): Promise<SessionPageDto> {
    const now = new Date();

    const items = await this.prisma.pomodoroSession.findMany({
      where: {
        userId,
        status: { in: [SessionStatus.COMPLETED, SessionStatus.CANCELLED] },
        ...(query.from || query.to
          ? {
              startedAt: {
                ...(query.from ? { gte: query.from } : {}),
                ...(query.to ? { lte: query.to } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    // One row beyond the page proves there is a next page without a second query.
    const hasMore = items.length > query.limit;
    const page = hasMore ? items.slice(0, query.limit) : items;

    return {
      items: page.map((session) => toSessionDto(session, now)),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  /**
   * Materialises sessions whose deadline has passed.
   *
   * Done lazily on read rather than by a scheduled worker: the outcome is
   * identical, because the end instant is computed from the deadline and not
   * from when the sweep happened, and the MVP avoids an extra moving part.
   */
  private async settleExpired(
    tx: Prisma.TransactionClient,
    userId: string,
    now: Date,
  ): Promise<void> {
    const running = await tx.pomodoroSession.findMany({
      where: { userId, status: SessionStatus.RUNNING },
    });

    for (const session of running) {
      if (!hasExpired(session, now)) continue;

      const endedAt = new Date(
        session.startedAt.getTime() + session.pausedAccumulatedMs + session.durationSec * 1000,
      );

      await tx.pomodoroSession.update({
        where: { id: session.id },
        data: { status: SessionStatus.COMPLETED, endedAt },
      });

      this.logger.log(`Settled expired session ${session.id} for user ${userId}`);
    }
  }

  private async applyUpdate(
    id: string,
    data: Prisma.PomodoroSessionUpdateInput,
    now: Date,
  ): Promise<SessionDto> {
    const updated = await this.prisma.pomodoroSession.update({ where: { id }, data });

    return toSessionDto(updated, now);
  }

  /**
   * Rejects a transition the state machine does not allow, and reports the
   * current status so the client can reconcile instead of retrying blindly.
   */
  private requireStatus(session: PomodoroSession, allowed: SessionStatus[], action: string): void {
    if (allowed.includes(session.status)) return;

    throw new ConflictException({
      code: 'INVALID_SESSION_TRANSITION',
      message: `Cannot ${action} a session that is ${session.status.toLowerCase()}.`,
      details: { sessionId: session.id, status: session.status },
    });
  }

  private async requireOwned(userId: string, id: string): Promise<PomodoroSession> {
    const session = await this.prisma.pomodoroSession.findFirst({ where: { id, userId } });

    if (!session) {
      throw new NotFoundException({ code: 'SESSION_NOT_FOUND', message: 'Session not found.' });
    }

    return session;
  }

  private async requireOwnedTask(userId: string, taskId: string): Promise<void> {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, userId } });

    if (!task) {
      throw new NotFoundException({ code: 'TASK_NOT_FOUND', message: 'Task not found.' });
    }
  }

  private async defaultDuration(userId: string, kind: SessionKind): Promise<number> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    switch (kind) {
      case SessionKind.FOCUS:
        return user.focusDurationSec;
      case SessionKind.SHORT_BREAK:
        return user.shortBreakSec;
      case SessionKind.LONG_BREAK:
        return user.longBreakSec;
    }
  }
}
