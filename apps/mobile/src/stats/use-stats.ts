import { useQuery } from '@tanstack/react-query';

import { STATS_RANGE_DAYS } from './stats-types';
import type { DailyPoint, ProjectBreakdown, StatsRange, Summary } from './stats-types';
import { fetchByProject, fetchDaily, fetchSummary } from './stats-api';

export const statsKey = ['stats'] as const;

export function useSummary(range: StatsRange) {
  return useQuery<Summary>({
    queryKey: [...statsKey, 'summary', range],
    queryFn: () => fetchSummary(range),
  });
}

export function useDaily(range: StatsRange) {
  const { from, to } = rangeDays(range);

  return useQuery<DailyPoint[]>({
    queryKey: [...statsKey, 'daily', from, to],
    queryFn: () => fetchDaily(from, to),
  });
}

export function useByProject(range: StatsRange) {
  return useQuery<ProjectBreakdown[]>({
    queryKey: [...statsKey, 'by-project', range],
    queryFn: () => fetchByProject(range),
  });
}

/**
 * The window as calendar days, ending today.
 *
 * Built from the device's local date rather than an ISO instant: the server is
 * told the time zone separately, and sending `2026-09-04T03:00:00Z` for what the
 * reader calls the 4th would shift the whole chart by a day.
 */
function rangeDays(range: StatsRange): { from: string; to: string } {
  const days = STATS_RANGE_DAYS[range];
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));

  return { from: isoDate(start), to: isoDate(today) };
}

function isoDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}
