/**
 * The offset between this device's clock and the server's.
 *
 * A Pomodoro deadline is an absolute instant decided by the server. A phone
 * whose clock is five minutes fast would count down to it five minutes early —
 * and phones with wrong clocks are common enough that "the timer ended too
 * soon" would be a real bug report, not a hypothetical one.
 *
 * So every session payload carries `serverTime`, and the client keeps the
 * difference. Nothing is ever counted from the device clock alone; `serverNow`
 * is the only instant the timer is allowed to compare against.
 */

let offsetMs = 0;

let sampled = false;

/**
 * Records a reading. `serverTime` is stamped when the request reaches the
 * server, so it is already stale by the return leg; adding half the round trip
 * places the reading at the moment the response arrived, which is what the
 * offset is measured against.
 *
 * Half the round trip assumes a symmetric path. It is not exact, but the error
 * is a fraction of a second against a timer that runs for minutes.
 */
export function recordServerTime(serverTime: string, sentAtMs: number, receivedAtMs: number): void {
  const serverInstant = Date.parse(serverTime);

  // A payload with an unparseable date must not silently corrupt the clock:
  // keeping the last good offset is better than counting down from NaN.
  if (Number.isNaN(serverInstant)) return;

  const roundTripMs = Math.max(0, receivedAtMs - sentAtMs);

  offsetMs = serverInstant + roundTripMs / 2 - receivedAtMs;
  sampled = true;
}

/** The current instant on the server's clock, in milliseconds. */
export function serverNow(): number {
  return Date.now() + offsetMs;
}

export function clockOffsetMs(): number {
  return offsetMs;
}

/**
 * Whether a reading has been taken yet. Before the first one the offset is
 * zero, which is a guess — the device clock — not a measurement.
 */
export function hasClockSample(): boolean {
  return sampled;
}

/** Dropped when the app is pointed at another backend, whose clock is its own. */
export function resetServerClock(): void {
  offsetMs = 0;
  sampled = false;
}
