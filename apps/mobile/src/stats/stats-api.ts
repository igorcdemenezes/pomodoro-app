import { authenticatedRequest } from '../api/authenticated-request';
import { deviceTimeZone } from '../api/device-time-zone';
import type { DailyPoint, ProjectBreakdown, StatsRange, Summary } from './stats-types';

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
