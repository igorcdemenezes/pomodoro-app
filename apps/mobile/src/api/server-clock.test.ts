import {
  clockOffsetMs,
  hasClockSample,
  recordServerTime,
  resetServerClock,
  serverNow,
} from './server-clock';

describe('server clock', () => {
  beforeEach(() => {
    resetServerClock();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    resetServerClock();
  });

  it('reports no sample before the first reading, so the device clock is a guess and not a measurement', () => {
    expect(hasClockSample()).toBe(false);
    expect(clockOffsetMs()).toBe(0);
  });

  it('measures how far the device clock is behind the server', () => {
    jest.setSystemTime(new Date('2026-09-03T12:00:00.000Z'));

    // Instantaneous round trip: the offset is the raw difference.
    recordServerTime('2026-09-03T12:00:30.000Z', Date.now(), Date.now());

    expect(clockOffsetMs()).toBe(30_000);
    expect(serverNow()).toBe(Date.parse('2026-09-03T12:00:30.000Z'));
  });

  it('measures a device clock that runs ahead as a negative offset', () => {
    jest.setSystemTime(new Date('2026-09-03T12:05:00.000Z'));

    recordServerTime('2026-09-03T12:00:00.000Z', Date.now(), Date.now());

    expect(clockOffsetMs()).toBe(-300_000);
  });

  it('compares the reading against the middle of the round trip, not against either end', () => {
    jest.setSystemTime(new Date('2026-09-03T12:00:00.000Z'));
    const sentAt = Date.now();
    const receivedAt = sentAt + 400;

    // The clocks are actually 200ms apart: the server stamped its instant
    // halfway through the round trip, so 200 of those 400ms are travel, not
    // disagreement. Crediting the stamp to the send instant would double the
    // offset and make every deadline land early.
    recordServerTime('2026-09-03T12:00:00.400Z', sentAt, receivedAt);

    expect(clockOffsetMs()).toBe(200);
  });

  it('keeps the last good offset when a payload carries an unparseable instant', () => {
    jest.setSystemTime(new Date('2026-09-03T12:00:00.000Z'));
    recordServerTime('2026-09-03T12:00:30.000Z', Date.now(), Date.now());

    recordServerTime('not a date', Date.now(), Date.now());

    expect(clockOffsetMs()).toBe(30_000);
  });

  it('follows the device clock once the offset is known', () => {
    jest.setSystemTime(new Date('2026-09-03T12:00:00.000Z'));
    recordServerTime('2026-09-03T12:00:30.000Z', Date.now(), Date.now());

    jest.setSystemTime(new Date('2026-09-03T12:01:00.000Z'));

    expect(serverNow()).toBe(Date.parse('2026-09-03T12:01:30.000Z'));
  });
});
