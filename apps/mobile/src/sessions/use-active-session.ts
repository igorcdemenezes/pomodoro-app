import { useQuery } from '@tanstack/react-query';

import { serverNow } from '../api/server-clock';
import type { Session } from './session-types';
import { fetchActiveSession } from './sessions-api';

export const activeSessionKey = ['sessions', 'active'] as const;

/** A refetch is never scheduled tighter than this, however close the deadline. */
const MIN_REFETCH_MS = 1_000;

/**
 * The session the app should be showing, straight from the server.
 *
 * This is the query that recovers a timer left running: the app asks on launch,
 * on every return to the foreground, and once more just after the deadline —
 * and adopts the answer. It restores nothing of its own, so a session started
 * on another device appears here without any syncing of state.
 */
export function useActiveSession() {
  return useQuery<Session | null>({
    queryKey: activeSessionKey,
    queryFn: fetchActiveSession,
    // A persisted session is fine to paint on the first frame, but it is a
    // placeholder: the server decides what is running, so every mount asks.
    staleTime: 0,
    refetchOnMount: 'always',
    // Polling a countdown every second would be pointless traffic — the client
    // can do the arithmetic. The one thing it cannot do is settle an expired
    // session, so a single refetch is aimed just past the deadline, where the
    // backend will have materialised it as completed.
    refetchInterval: (query) => {
      const session = query.state.data;

      if (!session || session.status !== 'RUNNING' || !session.dueAt) return false;

      const untilDueMs = Date.parse(session.dueAt) - serverNow();

      return Math.max(MIN_REFETCH_MS, untilDueMs + MIN_REFETCH_MS);
    },
  });
}
