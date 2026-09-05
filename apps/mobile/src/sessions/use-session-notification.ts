import { useEffect, useRef } from 'react';

import type { Session } from './session-types';
import { cancelSessionEnd, scheduleSessionEnd } from './session-notification';

/**
 * Keeps a single scheduled notification in step with the session on screen.
 *
 * It is booked with the operating system rather than fired by a timer in the
 * app, because the moment that matters is exactly the one where the app is not
 * in front of the user. Nothing here decides anything: the notification is a
 * copy of what the server already settled, so a stale one is cancelled rather
 * than trusted.
 */
export function useSessionEndNotification(session: Session | null): void {
  const booked = useRef<{ key: string; identifier: string } | null>(null);

  useEffect(() => {
    // A paused session has no deadline, and a session refetched unchanged must
    // not be rebooked — the query hands back a new object every poll.
    const key =
      session && session.status === 'RUNNING' && session.dueAt
        ? `${session.id}:${session.dueAt}`
        : null;

    if (booked.current?.key === key) return;

    const previous = booked.current;
    booked.current = null;

    if (previous) void cancelSessionEnd(previous.identifier);

    if (!key || !session) return;

    let abandoned = false;

    void scheduleSessionEnd(session).then((identifier) => {
      if (!identifier) return;

      // The session moved on while the permission prompt was open, so what was
      // just booked is already wrong.
      if (abandoned) {
        void cancelSessionEnd(identifier);
        return;
      }

      booked.current = { key, identifier };
    });

    return () => {
      abandoned = true;
    };
  }, [session]);
}
