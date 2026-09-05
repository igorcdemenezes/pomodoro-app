export const HISTORY_RANGES = ['week', 'month', 'all'] as const;

export type HistoryRange = (typeof HISTORY_RANGES)[number];

export const HISTORY_RANGE_LABELS: Record<HistoryRange, string> = {
  week: 'Week',
  month: 'Month',
  all: 'All',
};

const RANGE_DAYS: Record<Exclude<HistoryRange, 'all'>, number> = { week: 7, month: 30 };

/**
 * The instant a range opens, or undefined for the whole history.
 *
 * Anchored to local midnight rather than to "now minus N × 24h": a user asking
 * for the week means seven days on their calendar, and a rolling window would
 * drop this morning's first session as the afternoon wore on.
 */
export function rangeStart(range: HistoryRange, now: Date = new Date()): string | undefined {
  if (range === 'all') return undefined;

  const start = new Date(now);
  start.setDate(start.getDate() - (RANGE_DAYS[range] - 1));
  start.setHours(0, 0, 0, 0);

  return start.toISOString();
}
