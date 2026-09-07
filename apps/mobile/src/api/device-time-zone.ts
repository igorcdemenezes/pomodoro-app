/**
 * Which calendar day something belongs to is a question about the reader's
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
