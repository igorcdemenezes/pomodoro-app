import { useQuery } from '@tanstack/react-query';

import type { Cycle } from './session-types';
import { fetchCycle } from './sessions-api';

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
