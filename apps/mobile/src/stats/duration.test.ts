import { formatDay, formatDuration } from './duration';

describe('formatting focus time', () => {
  it.each([
    [0, '—'],
    [29, '—'],
    [60, '1m'],
    [1500, '25m'],
    [3600, '1h'],
    [5100, '1h 25m'],
  ])('says %i seconds as %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it('rounds to the minute rather than showing a precision it does not have', () => {
    // A session finished thirteen seconds early is still a 25 minute session.
    expect(formatDuration(1487)).toBe('25m');
  });
});

describe('formatting a calendar day', () => {
  it('reads a plain date without turning it into an instant', () => {
    // Parsed as text on purpose: `new Date('2026-09-04')` is midnight UTC, which
    // is the 3rd for any reader west of Greenwich.
    expect(formatDay('2026-09-04')).toBe('4 Sep');
  });

  it('leaves anything it cannot read alone', () => {
    expect(formatDay('not-a-day')).toBe('not-a-day');
  });
});
