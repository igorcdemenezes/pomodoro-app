import { SessionKind, SessionStatus } from '@prisma/client';
import type { PomodoroSession } from '@prisma/client';

import {
  dueAt,
  elapsedMs,
  hasExpired,
  isActive,
  pauseAccumulationOnResume,
  remainingMs,
} from './session-timing';

const MINUTE = 60_000;

function session(overrides: Partial<PomodoroSession> = {}): PomodoroSession {
  return {
    id: 'session-id',
    userId: 'user-id',
    taskId: null,
    kind: SessionKind.FOCUS,
    status: SessionStatus.RUNNING,
    startedAt: new Date('2026-09-03T10:00:00.000Z'),
    durationSec: 1500,
    pausedAt: null,
    pausedAccumulatedMs: 0,
    endedAt: null,
    clientMutationId: null,
    createdAt: new Date('2026-09-03T10:00:00.000Z'),
    updatedAt: new Date('2026-09-03T10:00:00.000Z'),
    ...overrides,
  };
}

const at = (iso: string) => new Date(iso);

describe('session timing', () => {
  describe('isActive', () => {
    it('treats running and paused as occupying the slot', () => {
      expect(isActive(SessionStatus.RUNNING)).toBe(true);
      expect(isActive(SessionStatus.PAUSED)).toBe(true);
      expect(isActive(SessionStatus.COMPLETED)).toBe(false);
      expect(isActive(SessionStatus.CANCELLED)).toBe(false);
    });
  });

  describe('elapsed and remaining', () => {
    it('counts wall-clock time while running', () => {
      const result = elapsedMs(session(), at('2026-09-03T10:10:00.000Z'));

      expect(result).toBe(10 * MINUTE);
    });

    it('freezes the clock while paused', () => {
      const paused = session({
        status: SessionStatus.PAUSED,
        pausedAt: at('2026-09-03T10:05:00.000Z'),
      });

      // An hour later, the session has still only consumed five minutes.
      expect(elapsedMs(paused, at('2026-09-03T11:05:00.000Z'))).toBe(5 * MINUTE);
    });

    it('excludes accumulated pauses once resumed', () => {
      const resumed = session({ pausedAccumulatedMs: 3 * MINUTE });

      expect(elapsedMs(resumed, at('2026-09-03T10:13:00.000Z'))).toBe(10 * MINUTE);
    });

    it('stops at the end instant for a finished session', () => {
      const finished = session({
        status: SessionStatus.COMPLETED,
        endedAt: at('2026-09-03T10:25:00.000Z'),
      });

      expect(elapsedMs(finished, at('2026-09-03T18:00:00.000Z'))).toBe(25 * MINUTE);
    });

    it('never reports negative elapsed time when clocks disagree', () => {
      expect(elapsedMs(session(), at('2026-09-03T09:59:00.000Z'))).toBe(0);
    });

    it('floors remaining time at zero past the deadline', () => {
      expect(remainingMs(session(), at('2026-09-03T10:40:00.000Z'))).toBe(0);
    });

    it('reports the remainder mid-session', () => {
      expect(remainingMs(session(), at('2026-09-03T10:05:00.000Z'))).toBe(20 * MINUTE);
    });
  });

  describe('deadline', () => {
    it('is the start plus the duration', () => {
      expect(dueAt(session())?.toISOString()).toBe('2026-09-03T10:25:00.000Z');
    });

    it('shifts forward by the time already spent paused', () => {
      const resumed = session({ pausedAccumulatedMs: 5 * MINUTE });

      expect(dueAt(resumed)?.toISOString()).toBe('2026-09-03T10:30:00.000Z');
    });

    it('does not exist while paused', () => {
      const paused = session({
        status: SessionStatus.PAUSED,
        pausedAt: at('2026-09-03T10:05:00.000Z'),
      });

      expect(dueAt(paused)).toBeNull();
      expect(hasExpired(paused, at('2026-09-04T10:00:00.000Z'))).toBe(false);
    });

    it('expires exactly at the deadline, not after it', () => {
      expect(hasExpired(session(), at('2026-09-03T10:24:59.999Z'))).toBe(false);
      expect(hasExpired(session(), at('2026-09-03T10:25:00.000Z'))).toBe(true);
    });
  });

  describe('resuming', () => {
    it('adds the frozen span to the accumulated total', () => {
      const paused = session({
        status: SessionStatus.PAUSED,
        pausedAt: at('2026-09-03T10:05:00.000Z'),
        pausedAccumulatedMs: 2 * MINUTE,
      });

      expect(pauseAccumulationOnResume(paused, at('2026-09-03T10:09:00.000Z'))).toBe(6 * MINUTE);
    });

    it('leaves the total untouched when there is no pause instant', () => {
      expect(pauseAccumulationOnResume(session({ pausedAccumulatedMs: 7 }), new Date())).toBe(7);
    });
  });
});
