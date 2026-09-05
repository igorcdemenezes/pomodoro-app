import type { Session } from '../sessions/session-types';
import { formatClock, groupByDay, localDay } from './history-grouping';

const TODAY = new Date(2026, 8, 4, 15, 0);

/** Built from local parts so the assertions hold in any time zone. */
function session(startedAt: Date, id = startedAt.toISOString()): Session {
  return {
    id,
    taskId: null,
    kind: 'FOCUS',
    status: 'COMPLETED',
    startedAt: startedAt.toISOString(),
    durationSec: 1500,
    endedAt: null,
    elapsedSec: 1500,
    remainingSec: 0,
    dueAt: null,
    serverTime: TODAY.toISOString(),
  };
}

describe('history grouping', () => {
  it('names the two days a person would not read as a date', () => {
    const sections = groupByDay(
      [session(new Date(2026, 8, 4, 9, 0)), session(new Date(2026, 8, 3, 9, 0))],
      TODAY,
    );

    expect(sections.map((section) => section.title)).toEqual(['Today', 'Yesterday']);
  });

  it('keeps the year on days outside the current one', () => {
    const sections = groupByDay([session(new Date(2025, 11, 31, 9, 0))], TODAY);

    expect(sections[0].title).toBe('31 Dec 2025');
  });

  it('keeps sessions of the same day together, in the order they arrived', () => {
    const sections = groupByDay(
      [
        session(new Date(2026, 8, 4, 14, 0)),
        session(new Date(2026, 8, 4, 9, 0)),
        session(new Date(2026, 8, 2, 9, 0)),
      ],
      TODAY,
    );

    expect(sections).toHaveLength(2);
    expect(sections[0].data).toHaveLength(2);
    expect(sections[0].data[0].startedAt).toBe(new Date(2026, 8, 4, 14, 0).toISOString());
    expect(sections[1].title).toBe('2 Sep');
  });

  it('places a session on the day the device says it happened', () => {
    // A late-evening session belongs to the evening the user lived, not to the
    // UTC day the instant falls in.
    const late = new Date(2026, 8, 4, 23, 45);

    expect(localDay(late.toISOString())).toBe('2026-09-04');
    expect(formatClock(late.toISOString())).toBe('23:45');
  });
});
