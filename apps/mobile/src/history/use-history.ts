import { useInfiniteQuery } from '@tanstack/react-query';

import type { SessionPage } from '../sessions/session-types';
import { fetchHistory } from './history-api';
import { rangeStart } from './history-range';
import type { HistoryRange } from './history-range';

export const historyKey = ['sessions', 'history'] as const;

const PAGE_SIZE = 20;

/**
 * The user's finished sessions, one page at a time.
 *
 * The window is derived at fetch time rather than stored in the key: an app left
 * open past midnight would otherwise keep asking for yesterday's week.
 */
export function useHistory(range: HistoryRange) {
  return useInfiniteQuery({
    queryKey: [...historyKey, range],
    queryFn: ({ pageParam }) =>
      fetchHistory({
        from: rangeStart(range),
        cursor: pageParam ?? undefined,
        limit: PAGE_SIZE,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: SessionPage) => last.nextCursor,
  });
}
