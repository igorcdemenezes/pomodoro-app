import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { HttpError } from '../api/http-error';
import { activeSessionKey } from './use-active-session';
import type { Session, SessionKind } from './session-types';
import { startSession, transitionSession } from './sessions-api';
import type { SessionTransition } from './sessions-api';

export interface StartRequest {
  kind: SessionKind;
  taskId?: string;
  durationSec?: number;
}

/**
 * The four buttons on the timer, and what they do to the cached session.
 *
 * Each call answers with the updated session, which is written straight into
 * the cache — the screen never guesses at the next state, so an optimistic
 * update can never disagree with the server.
 *
 * A 409 is not a failure to report and forget: it means this device's idea of
 * the session is out of date, which is exactly what happens when the other
 * device paused it first. The cache is invalidated so the screen reconciles
 * with what is actually running.
 */
export function useSessionControls() {
  const client = useQueryClient();

  const adopt = useCallback(
    (session: Session) => client.setQueryData(activeSessionKey, session),
    [client],
  );

  const reconcile = useCallback(
    (error: unknown) => {
      if (error instanceof HttpError && error.isConflict) {
        void client.invalidateQueries({ queryKey: activeSessionKey });
      }
    },
    [client],
  );

  const startMutation = useMutation({
    mutationFn: startSession,
    onSuccess: adopt,
    onError: reconcile,
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: SessionTransition }) =>
      transitionSession(id, action),
    onSuccess: (session) => {
      adopt(session);

      // A session that is over no longer occupies the slot, and the endpoint
      // that serves this cache entry would answer 204. Asking again is what
      // clears the screen back to idle.
      if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
        void client.invalidateQueries({ queryKey: activeSessionKey });
      }
    },
    onError: reconcile,
  });

  /**
   * The idempotency key is minted here, once per tap, rather than inside the
   * request. A retry — after a dropped connection, or when a mutation queued
   * offline finally goes out — carries the same key, so a start whose response
   * was lost resolves to the session it already created instead of a second
   * one.
   */
  const start = useCallback(
    (request: StartRequest) =>
      startMutation.mutate({ ...request, clientMutationId: Crypto.randomUUID() }),
    [startMutation],
  );

  const transition = useCallback(
    (id: string, action: SessionTransition) => transitionMutation.mutate({ id, action }),
    [transitionMutation],
  );

  return {
    start,
    pause: (id: string) => transition(id, 'pause'),
    resume: (id: string) => transition(id, 'resume'),
    complete: (id: string) => transition(id, 'complete'),
    cancel: (id: string) => transition(id, 'cancel'),
    pending: startMutation.isPending || transitionMutation.isPending,
    error: asHttpError(startMutation.error ?? transitionMutation.error),
    clearError: () => {
      startMutation.reset();
      transitionMutation.reset();
    },
  };
}

/** Anything thrown outside the HTTP client still has to be presentable. */
function asHttpError(error: unknown): HttpError | null {
  if (!error) return null;

  return error instanceof HttpError ? error : HttpError.offline(error);
}
