import type { Session } from '../sessions/session-types';
import { formatDay } from '../stats/duration';

export interface DaySection {
  /** Calendar day, `YYYY-MM-DD`, on the device's clock. */
  day: string;
  title: string;
  data: Session[];
}

/**
 * The page of sessions, cut into the days the reader lived through.
 *
 * Sections carry no totals on purpose. The list is paginated, so a day can
 * arrive split across two pages, and a subtotal computed from what is loaded
 * would silently disagree with the Statistics screen — where the same figure is
 * aggregated in SQL over every session. Days here answer "when", not "how much".
 */
export function groupByDay(sessions: Session[], today: Date = new Date()): DaySection[] {
  const sections: DaySection[] = [];

  // The server already orders by start instant, descending; grouping keeps that
  // order instead of re-sorting, so the sections stay in the order they arrived.
  for (const session of sessions) {
    const day = localDay(session.startedAt);
    const current = sections.at(-1);

    if (current?.day === day) {
      current.data.push(session);
      continue;
    }

    sections.push({ day, title: dayTitle(day, today), data: [session] });
  }

  return sections;
}

/** The calendar day an instant falls on, as the device's clock reads it. */
export function localDay(instant: string): string {
  return isoDate(new Date(instant));
}

/** `14:05` on the device's clock, in 24-hour form. */
export function formatClock(instant: string): string {
  const date = new Date(instant);
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');

  return `${hours}:${minutes}`;
}

function dayTitle(day: string, today: Date): string {
  if (day === isoDate(today)) return 'Today';

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (day === isoDate(yesterday)) return 'Yesterday';

  // A bare `4 Sep` would name four different days once the history is a few
  // years long, so anything outside the current year keeps its year.
  const year = Number(day.slice(0, 4));

  return year === today.getFullYear() ? formatDay(day) : `${formatDay(day)} ${year}`;
}

function isoDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}
