import { SessionStatus } from '@prisma/client';
import type { PomodoroSession } from '@prisma/client';

/**
 * Timer arithmetic, kept free of the database and of Nest.
 *
 * A session persists *when it began*, *how long it should last* and *how long
 * it has been paused*. Everything a client shows is derived from those three
 * values and the current instant, which is why closing the app, restarting the
 * backend or opening a second device cannot desynchronise the timer: there is
 * no synchronised state, only a shared calculation.
 */

/** A session is active while it occupies the one-per-user slot. */
export function isActive(status: SessionStatus): boolean {
  return status === SessionStatus.RUNNING || status === SessionStatus.PAUSED;
}

/**
 * Time the session has actually been running, excluding pauses.
 *
 * While paused the clock is frozen at the instant of the pause, so a session
 * left paused overnight has not consumed its duration.
 */
export function elapsedMs(session: PomodoroSession, now: Date): number {
  const reference =
    session.status === SessionStatus.PAUSED && session.pausedAt
      ? session.pausedAt
      : (session.endedAt ?? now);

  const raw = reference.getTime() - session.startedAt.getTime() - session.pausedAccumulatedMs;

  return Math.max(0, raw);
}

export function remainingMs(session: PomodoroSession, now: Date): number {
  return Math.max(0, session.durationSec * 1000 - elapsedMs(session, now));
}

/**
 * The instant a RUNNING session is due to finish, shifted by however long it
 * has been paused. Null while paused, because a paused session has no deadline
 * until it resumes.
 */
export function dueAt(session: PomodoroSession): Date | null {
  if (session.status !== SessionStatus.RUNNING) return null;

  return new Date(
    session.startedAt.getTime() + session.pausedAccumulatedMs + session.durationSec * 1000,
  );
}

export function hasExpired(session: PomodoroSession, now: Date): boolean {
  const due = dueAt(session);

  return due !== null && due.getTime() <= now.getTime();
}

/**
 * Pausing freezes the clock. Resuming adds the frozen span to the accumulated
 * pause total, which is what shifts the deadline forward.
 */
export function pauseAccumulationOnResume(session: PomodoroSession, now: Date): number {
  if (!session.pausedAt) return session.pausedAccumulatedMs;

  const pausedFor = Math.max(0, now.getTime() - session.pausedAt.getTime());

  return session.pausedAccumulatedMs + pausedFor;
}
