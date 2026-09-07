import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { HttpError } from '../api/http-error';
import type { Cycle } from './session-types';
import { fetchCycle, resetCycle } from './sessions-api';

export const cycleKey = ['sessions', 'cycle'] as const;

/**
 * The run of focus sessions leading to the next long break.
 *
 * Kept out of the active-session query on purpose: the position in the cycle
 * still has an answer when nothing is running, which is exactly when the user
 * is deciding what to start next.
 */
export function useCycle() {
  return useQuery<Cycle>({ queryKey: cycleKey, queryFn: fetchCycle });
}

/**
 * Starting the run over, for a user who lost track of it.
 *
 * The server answers with the run as it stands after the reset, and that
 * answer is written straight into the cache: the row never shows a zero the
 * server has not confirmed, and a second device sees the same run on its next
 * fetch.
 */
export function useResetCycle(onReset?: (cycle: Cycle) => void) {
  const client = useQueryClient();

  const mutation = useMutation({
    mutationFn: resetCycle,
    onSuccess: (cycle) => {
      client.setQueryData(cycleKey, cycle);
      onReset?.(cycle);
    },
  });

  return {
    reset: () => mutation.mutate(),
    pending: mutation.isPending,
    error: mutation.error ? asHttpError(mutation.error) : null,
    clearError: () => mutation.reset(),
  };
}

function asHttpError(error: unknown): HttpError {
  return error instanceof HttpError ? error : HttpError.offline(error);
}
