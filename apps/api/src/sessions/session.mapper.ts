import type { PomodoroSession } from '@prisma/client';

import type { SessionDto } from './dto/session.dto';
import { dueAt, elapsedMs, remainingMs } from './session-timing';

export function toSessionDto(session: PomodoroSession, now: Date): SessionDto {
  return {
    id: session.id,
    taskId: session.taskId,
    kind: session.kind,
    status: session.status,
    startedAt: session.startedAt,
    durationSec: session.durationSec,
    endedAt: session.endedAt,
    elapsedSec: Math.floor(elapsedMs(session, now) / 1000),
    remainingSec: Math.ceil(remainingMs(session, now) / 1000),
    dueAt: dueAt(session),
    // Sent on every session payload so the client can measure its clock offset
    // against the server rather than trusting the device clock.
    serverTime: now,
  };
}
