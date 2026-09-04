import { formatCountdown, hasExpired, progress, remainingMs } from './session-timing';
import type { Session } from './session-types';

const START = '2026-09-03T12:00:00.000Z';

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: 'a5b6c7d8-0000-4000-8000-000000000001',
    taskId: null,
    kind: 'FOCUS',
    status: 'RUNNING',
    startedAt: START,
    durationSec: 1500,
    endedAt: null,
    elapsedSec: 0,
    remainingSec: 1500,
    dueAt: '2026-09-03T12:25:00.000Z',
    serverTime: START,
    ...overrides,
  };
}

const at = (iso: string) => Date.parse(iso);

describe('countdown', () => {
  describe('a running session', () => {
    it('counts down to the deadline', () => {
      expect(remainingMs(session(), at('2026-09-03T12:10:00.000Z'))).toBe(15 * 60 * 1000);
    });

    it('ignores the remaining count in the payload, which is stale on arrival', () => {
      // Ten minutes of screen time later, the payload still claims a full
      // 25 minutes. The deadline is what stayed true.
      const stale = session({ remainingSec: 1500 });

      expect(remainingMs(stale, at('2026-09-03T12:10:00.000Z'))).toBe(15 * 60 * 1000);
    });

    it('never goes negative once the deadline has passed', () => {
      expect(remainingMs(session(), at('2026-09-03T13:00:00.000Z'))).toBe(0);
    });
  });

  describe('a paused session', () => {
    const paused = session({ status: 'PAUSED', dueAt: null, remainingSec: 900 });

    it('reads the frozen count from the payload, since a paused session has no deadline', () => {
      expect(remainingMs(paused, at('2026-09-03T12:10:00.000Z'))).toBe(900_000);
    });

    it('does not drain while time passes', () => {
      expect(remainingMs(paused, at('2026-09-04T12:00:00.000Z'))).toBe(900_000);
    });
  });

  it('shows nothing left on a session that already ended', () => {
    const done = session({ status: 'COMPLETED', endedAt: '2026-09-03T12:25:00.000Z' });

    expect(remainingMs(done, at('2026-09-03T12:26:00.000Z'))).toBe(0);
  });
});

describe('expiry', () => {
  it('flags a running session whose deadline has passed, so the app asks the server to settle it', () => {
    expect(hasExpired(session(), at('2026-09-03T12:25:00.000Z'))).toBe(true);
  });

  it('does not flag one that is still running', () => {
    expect(hasExpired(session(), at('2026-09-03T12:24:59.000Z'))).toBe(false);
  });

  it('does not flag a paused session with no time left, because nothing is due', () => {
    const paused = session({ status: 'PAUSED', dueAt: null, remainingSec: 0 });

    expect(hasExpired(paused, at('2026-09-03T12:25:00.000Z'))).toBe(false);
  });
});

describe('progress', () => {
  it('starts empty and fills to the deadline', () => {
    expect(progress(session(), at(START))).toBe(0);
    expect(progress(session(), at('2026-09-03T12:12:30.000Z'))).toBeCloseTo(0.5);
    expect(progress(session(), at('2026-09-03T12:25:00.000Z'))).toBe(1);
  });

  it('stays full once the session is over', () => {
    const done = session({ status: 'COMPLETED' });

    expect(progress(done, at('2026-09-03T12:30:00.000Z'))).toBe(1);
  });
});

describe('formatting', () => {
  it('rounds up, so a fresh session reads its full duration', () => {
    expect(formatCountdown(1500 * 1000)).toBe('25:00');
    expect(formatCountdown(1500 * 1000 - 1)).toBe('25:00');
  });

  it('reaches zero only when the time is genuinely gone', () => {
    expect(formatCountdown(1)).toBe('00:01');
    expect(formatCountdown(0)).toBe('00:00');
  });

  it('adds an hours field past the hour', () => {
    expect(formatCountdown(3_600_000)).toBe('1:00:00');
    expect(formatCountdown(3_661_000)).toBe('1:01:01');
  });

  it('treats a negative span as spent rather than printing a minus sign', () => {
    expect(formatCountdown(-5000)).toBe('00:00');
  });
});
