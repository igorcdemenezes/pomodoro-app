/** The metrics contract, mirrored from the backend's stats DTOs. */

export const STATS_RANGES = ['week', 'month'] as const;

export type StatsRange = (typeof STATS_RANGES)[number];

export const STATS_RANGE_LABELS: Record<StatsRange, string> = {
  week: 'Week',
  month: 'Month',
};

/** How many days back each range covers, inclusive of today. */
export const STATS_RANGE_DAYS: Record<StatsRange, number> = {
  week: 7,
  month: 30,
};

export interface Summary {
  focusedSeconds: number;
  focusedSecondsToday: number;
  completedSessions: number;
  cancelledSessions: number;
  /** Completed over completed plus cancelled; 0 when none were attempted. */
  completionRate: number;
  currentStreakDays: number;
  tasksCompleted: number;
}

export interface DailyPoint {
  /** Calendar day, `YYYY-MM-DD`, in the requested time zone. */
  day: string;
  focusedSeconds: number;
  completedSessions: number;
}

export interface ProjectBreakdown {
  /** Null for the bucket holding sessions filed under no project. */
  projectId: string | null;
  projectName: string;
  color: string;
  focusedSeconds: number;
  completedSessions: number;
}
