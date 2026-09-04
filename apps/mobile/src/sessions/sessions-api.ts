import { authenticatedRequest } from '../api/authenticated-request';
import { recordServerTime } from '../api/server-clock';
import type { Session, StartSessionInput } from './session-types';

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

export type SessionTransition = 'pause' | 'resume' | 'complete' | 'cancel';

export function transitionSession(id: string, action: SessionTransition): Promise<Session> {
  return timed(() =>
    authenticatedRequest<Session>(`/sessions/${id}/${action}`, { method: 'PATCH' }),
  );
}
