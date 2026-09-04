import type { Session, SessionStatus } from './session-types';

/**
 * What the timer shows, derived rather than stored.
 *
 * The client keeps no countdown of its own. It reads the session's deadline and
 * subtracts the current instant on the server's clock, which is why killing the
 * app, restarting the backend or opening a second device all land on the same
 * number: there is no local state to fall out of sync.
 */

/** A session is active while it occupies the one-per-user slot. */
export function isActive(status: SessionStatus): boolean {
  return status === 'RUNNING' || status === 'PAUSED';
}

/**
 * Milliseconds left, measured against an instant on the server's clock.
 *
 * A running session is measured from `dueAt`, not from the `remainingSec` in
 * the payload: an absolute instant stays true however long the response sat in
 * flight or the screen sat idle, while a remaining count is stale the moment it
 * is serialised.
 *
 * A paused session has no deadline — the server nulls `dueAt`, because the
 * clock is frozen — so there the payload's count is the answer, and it stays
 * correct precisely because nothing is ticking.
 */
export function remainingMs(session: Session, serverNowMs: number): number {
  if (!isActive(session.status)) return 0;

  if (session.status === 'RUNNING' && session.dueAt) {
    return Math.max(0, Date.parse(session.dueAt) - serverNowMs);
  }

  return Math.max(0, session.remainingSec * 1000);
}

/** How much of the session is behind it, from 0 to 1, for the dial. */
export function progress(session: Session, serverNowMs: number): number {
  const totalMs = session.durationSec * 1000;

  if (totalMs <= 0) return 1;

  return Math.min(1, Math.max(0, 1 - remainingMs(session, serverNowMs) / totalMs));
}

/**
 * A running session whose deadline has passed but which the server has not
 * settled yet — the app has to ask for the settled row rather than announce a
 * completion the backend has not recorded.
 */
export function hasExpired(session: Session, serverNowMs: number): boolean {
  return session.status === 'RUNNING' && remainingMs(session, serverNowMs) === 0;
}

/**
 * `mm:ss`, or `h:mm:ss` past an hour.
 *
 * Rounded up, so a fresh 25-minute session reads 25:00 rather than 24:59, and
 * 00:00 appears only when the time is genuinely gone.
 */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  const pad = (value: number) => String(value).padStart(2, '0');

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
