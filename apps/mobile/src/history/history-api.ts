import { authenticatedRequest } from '../api/authenticated-request';
import type { SessionPage } from '../sessions/session-types';

export interface HistoryQuery {
  /** ISO instant; sessions started before it are left out. */
  from?: string;
  /** The id the previous page ended on. Absent for the first page. */
  cursor?: string;
  limit?: number;
}

/**
 * Finished sessions, most recent first.
 *
 * Paged by cursor rather than by offset: the list is ordered by an instant that
 * keeps growing, so a page number would skip or repeat rows as sessions are
 * recorded while the user scrolls.
 */
export function fetchHistory(query: HistoryQuery = {}): Promise<SessionPage> {
  const search = Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');

  return authenticatedRequest<SessionPage>(`/sessions${search ? `?${search}` : ''}`);
}
