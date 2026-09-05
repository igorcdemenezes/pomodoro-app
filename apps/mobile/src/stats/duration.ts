/**
 * Focus time as a person would say it: `1h 25m`, `25m`, `—` for none.
 *
 * Seconds are never shown. A Pomodoro is measured in minutes, and a figure like
 * `1h 25m 13s` invites the reader to compare a precision the number does not
 * have — the last session may have been finished a few seconds early.
 */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);

  if (totalMinutes <= 0) return '—';

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;

  return `${hours}h ${minutes}m`;
}

/** `2026-09-04` as `4 Sep`. Parsed as a plain date, never as an instant. */
export function formatDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number);

  if (!year || !month || !date) return day;

  return `${date} ${MONTHS[month - 1]}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
