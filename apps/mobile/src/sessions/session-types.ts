/**
 * The session contract, mirrored from the backend's `SessionDto`.
 *
 * Instants are ISO 8601 strings because JSON has no date type — including
 * `serverTime`, which is what lets the client correct for a wrong device clock
 * instead of trusting it.
 */

export const SESSION_KINDS = ['FOCUS', 'SHORT_BREAK', 'LONG_BREAK'] as const;

export type SessionKind = (typeof SESSION_KINDS)[number];

export type SessionStatus = 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export interface Session {
  id: string;
  taskId: string | null;
  kind: SessionKind;
  status: SessionStatus;
  startedAt: string;
  durationSec: number;
  endedAt: string | null;
  /** Seconds actually run, excluding pauses. */
  elapsedSec: number;
  /** Seconds left at the instant the payload was built. */
  remainingSec: number;
  /** When a running session is due to finish. Null while paused. */
  dueAt: string | null;
  serverTime: string;
}

export interface SessionPage {
  items: Session[];
  nextCursor: string | null;
}

export interface StartSessionInput {
  kind: SessionKind;
  taskId?: string;
  durationSec?: number;
  /** Idempotency key: a retried start resolves to the same session. */
  clientMutationId: string;
}

export const SESSION_KIND_LABELS: Record<SessionKind, string> = {
  FOCUS: 'Focus',
  SHORT_BREAK: 'Short break',
  LONG_BREAK: 'Long break',
};
