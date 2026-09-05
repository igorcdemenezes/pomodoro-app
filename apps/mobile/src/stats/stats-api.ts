import { authenticatedRequest } from '../api/authenticated-request';
import type { DailyPoint, ProjectBreakdown, StatsRange, Summary } from './stats-types';

/**
 * Which calendar day a session belongs to is a question about the reader's
 * clock, not the server's. The backend defaults to UTC, so without this a
 * session finished at 21:30 in São Paulo would be counted as tomorrow's — and
 * "focused today" would read zero for the rest of the evening.
 */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function fetchSummary(range: StatsRange): Promise<Summary> {
  const query = `range=${range}&timeZone=${encodeURIComponent(deviceTimeZone())}`;

  return authenticatedRequest<Summary>(`/stats/summary?${query}`);
}

export function fetchDaily(from: string, to: string): Promise<DailyPoint[]> {
  const query = `from=${from}&to=${to}&timeZone=${encodeURIComponent(deviceTimeZone())}`;

  return authenticatedRequest<DailyPoint[]>(`/stats/daily?${query}`);
}

export function fetchByProject(range: StatsRange): Promise<ProjectBreakdown[]> {
  return authenticatedRequest<ProjectBreakdown[]>(`/stats/by-project?range=${range}`);
}
