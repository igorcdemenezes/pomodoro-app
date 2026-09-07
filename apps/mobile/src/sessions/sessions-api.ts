import { authenticatedRequest } from '../api/authenticated-request';
import { deviceTimeZone } from '../api/device-time-zone';
import { recordServerTime } from '../api/server-clock';
import type { Cycle, Session, StartSessionInput } from './session-types';

/**
 * Every endpoint here answers with the server's instant, and every call feeds
 * it to the clock. The offset is therefore refreshed by ordinary use — no
 * separate time-sync request, and no window in which the timer runs against an
 * offset measured hours ago.
 */
async function timed<T extends Session | null>(call: () => Promise<T>): Promise<T> {
  const sentAt = Date.now();
  const result = await call();

  if (result) recordServerTime(result.serverTime, sentAt, Date.now());

  return result;
}

export function startSession(input: StartSessionInput): Promise<Session> {
  return timed(() =>
    authenticatedRequest<Session>('/sessions/start', { method: 'POST', body: input }),
  );
}

/**
 * The session the app should be showing, or null when there is none.
 *
 * This is the call that recovers a timer the user left running: the app asks on
 * launch and adopts whatever the server says, rather than restoring anything of
 * its own.
 */
export function fetchActiveSession(): Promise<Session | null> {
  // The endpoint answers 204 when there is no session, which the HTTP client
  // resolves to undefined. React Query rejects undefined as data, and null is
  // the more honest value anyway: asked, and the answer is none.
  return timed(async () => {
    const active = await authenticatedRequest<Session | undefined>('/sessions/active');

    return active ?? null;
  });
}

/**
 * How far into the current run of Pomodoros the user is.
 *
 * Asked of the server rather than counted here: the run has to survive the app
 * being closed halfway through it, and a second device must not show a
 * different position. The time zone travels with the request because the run
 * restarts at the reader's midnight, not at UTC's.
 */
export function fetchCycle(): Promise<Cycle> {
  return authenticatedRequest<Cycle>(
    `/sessions/cycle?timeZone=${encodeURIComponent(deviceTimeZone())}`,
  );
}

/**
 * Starts the run over from now. The Pomodoros already done stay in the
 * statistics; they only stop counting toward the long break. Answers with the
 * run as the server now sees it, so the screen adopts it rather than assuming.
 */
export function resetCycle(): Promise<Cycle> {
  return authenticatedRequest<Cycle>(
    `/sessions/cycle/reset?timeZone=${encodeURIComponent(deviceTimeZone())}`,
    { method: 'POST' },
  );
}

export type SessionTransition = 'pause' | 'resume' | 'complete' | 'cancel';

export function transitionSession(id: string, action: SessionTransition): Promise<Session> {
  return timed(() =>
    authenticatedRequest<Session>(`/sessions/${id}/${action}`, { method: 'PATCH' }),
  );
}
