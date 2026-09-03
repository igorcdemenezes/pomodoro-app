import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';

import { asUser, createTestApp, signUp } from './app-harness';
import type { SignedInUser } from './app-harness';
import { prisma, resetDatabase } from './prisma-test-client';

const MINUTE = 60_000;

describe('Pomodoro sessions (e2e)', () => {
  let app: INestApplication;
  let alice: SignedInUser;
  let bob: SignedInUser;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
    alice = await signUp(app, 'alice@example.com');
    bob = await signUp(app, 'bob@example.com');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const a = () => asUser(app, alice);
  const b = () => asUser(app, bob);

  const startFocus = (user = alice, overrides: Record<string, unknown> = {}) =>
    asUser(app, user)
      .post('/api/v1/sessions/start')
      .send({ kind: 'FOCUS', clientMutationId: randomUUID(), ...overrides });

  /**
   * Shifts a whole session back in time, without waiting for real minutes to
   * pass. Every instant moves by the same amount, so the row stays coherent —
   * rewinding only startedAt would describe a session paused long after it
   * began, which no code path can produce.
   */
  const ageSession = async (id: string, minutes: number) => {
    const session = await prisma.pomodoroSession.findUniqueOrThrow({ where: { id } });
    const shift = minutes * MINUTE;

    return prisma.pomodoroSession.update({
      where: { id },
      data: {
        startedAt: new Date(session.startedAt.getTime() - shift),
        ...(session.pausedAt ? { pausedAt: new Date(session.pausedAt.getTime() - shift) } : {}),
      },
    });
  };

  describe('starting', () => {
    it('starts a focus session using the user default duration', async () => {
      const response = await startFocus().expect(201);

      expect(response.body).toMatchObject({
        kind: 'FOCUS',
        status: 'RUNNING',
        durationSec: 1500,
        elapsedSec: 0,
      });
      expect(response.body.remainingSec).toBeLessThanOrEqual(1500);
      expect(response.body.remainingSec).toBeGreaterThan(1490);
      expect(Date.parse(response.body.serverTime)).not.toBeNaN();
      expect(Date.parse(response.body.dueAt)).not.toBeNaN();
    });

    it('honours an explicit duration', async () => {
      const response = await startFocus(alice, { durationSec: 600 }).expect(201);

      expect(response.body.durationSec).toBe(600);
    });

    it('uses the break preference for a break session', async () => {
      const response = await startFocus(alice, { kind: 'SHORT_BREAK' }).expect(201);

      expect(response.body.durationSec).toBe(300);
    });

    it('refuses a second session while one is active', async () => {
      const first = await startFocus().expect(201);

      const response = await startFocus().expect(409);

      expect(response.body).toMatchObject({
        code: 'SESSION_ALREADY_ACTIVE',
        details: { activeSessionId: first.body.id },
      });
    });

    it('refuses a second session while the first is only paused', async () => {
      const first = await startFocus().expect(201);
      await a().patch(`/api/v1/sessions/${first.body.id}/pause`).expect(200);

      await startFocus().expect(409);
    });

    it('lets a different user start their own session', async () => {
      await startFocus(alice).expect(201);

      await startFocus(bob).expect(201);
    });

    it('attaches the session to a task of the same owner', async () => {
      const { body: task } = await a()
        .post('/api/v1/tasks')
        .send({ title: 'Focus on me' })
        .expect(201);

      const response = await startFocus(alice, { taskId: task.id }).expect(201);

      expect(response.body.taskId).toBe(task.id);
    });

    it('refuses to attach the session to another user task', async () => {
      const { body: task } = await b()
        .post('/api/v1/tasks')
        .send({ title: 'Bob task' })
        .expect(201);

      const response = await startFocus(alice, { taskId: task.id }).expect(404);

      expect(response.body.code).toBe('TASK_NOT_FOUND');
    });

    it('requires a client mutation id', async () => {
      await a().post('/api/v1/sessions/start').send({ kind: 'FOCUS' }).expect(400);
    });
  });

  describe('idempotency', () => {
    it('returns the same session when a start request is retried', async () => {
      const clientMutationId = randomUUID();

      const first = await a()
        .post('/api/v1/sessions/start')
        .send({ kind: 'FOCUS', clientMutationId })
        .expect(201);

      // The client never saw the first response and resends after reconnecting.
      const retry = await a()
        .post('/api/v1/sessions/start')
        .send({ kind: 'FOCUS', clientMutationId })
        .expect(201);

      expect(retry.body.id).toBe(first.body.id);
      await expect(prisma.pomodoroSession.count({ where: { userId: alice.id } })).resolves.toBe(1);
    });
  });

  describe('concurrency', () => {
    it('lets exactly one of two simultaneous starts win', async () => {
      const results = await Promise.allSettled([
        startFocus().then((r) => r.status),
        startFocus().then((r) => r.status),
      ]);

      const statuses = results.map((r) => (r.status === 'fulfilled' ? r.value : 0)).sort();

      expect(statuses).toEqual([201, 409]);
      await expect(prisma.pomodoroSession.count({ where: { userId: alice.id } })).resolves.toBe(1);
    });
  });

  describe('the state machine', () => {
    it('pauses, freezing the remaining time', async () => {
      const { body: started } = await startFocus(alice, { durationSec: 600 }).expect(201);

      const paused = await a().patch(`/api/v1/sessions/${started.id}/pause`).expect(200);

      expect(paused.body.status).toBe('PAUSED');
      expect(paused.body.dueAt).toBeNull();

      const active = await a().get('/api/v1/sessions/active').expect(200);
      expect(active.body.remainingSec).toBe(paused.body.remainingSec);
    });

    it('resumes, shifting the deadline by the paused span', async () => {
      const { body: started } = await startFocus(alice, { durationSec: 600 }).expect(201);
      await a().patch(`/api/v1/sessions/${started.id}/pause`).expect(200);

      const resumed = await a().patch(`/api/v1/sessions/${started.id}/resume`).expect(200);

      expect(resumed.body.status).toBe('RUNNING');
      expect(Date.parse(resumed.body.dueAt)).toBeGreaterThanOrEqual(Date.parse(started.dueAt));

      const stored = await prisma.pomodoroSession.findUniqueOrThrow({ where: { id: started.id } });
      expect(stored.pausedAt).toBeNull();
      expect(stored.pausedAccumulatedMs).toBeGreaterThanOrEqual(0);
    });

    it('completes a session and frees the slot', async () => {
      const { body: started } = await startFocus().expect(201);

      const completed = await a().patch(`/api/v1/sessions/${started.id}/complete`).expect(200);
      expect(completed.body.status).toBe('COMPLETED');
      expect(completed.body.endedAt).not.toBeNull();

      await a().get('/api/v1/sessions/active').expect(204);
      await startFocus().expect(201);
    });

    it('cancels a session', async () => {
      const { body: started } = await startFocus().expect(201);

      const cancelled = await a().patch(`/api/v1/sessions/${started.id}/cancel`).expect(200);

      expect(cancelled.body.status).toBe('CANCELLED');
      await a().get('/api/v1/sessions/active').expect(204);
    });

    it('refuses to resume a running session', async () => {
      const { body: started } = await startFocus().expect(201);

      const response = await a().patch(`/api/v1/sessions/${started.id}/resume`).expect(409);

      expect(response.body).toMatchObject({
        code: 'INVALID_SESSION_TRANSITION',
        details: { status: 'RUNNING' },
      });
    });

    it('refuses to pause a completed session', async () => {
      const { body: started } = await startFocus().expect(201);
      await a().patch(`/api/v1/sessions/${started.id}/complete`).expect(200);

      await a().patch(`/api/v1/sessions/${started.id}/pause`).expect(409);
    });

    it('refuses to complete an already completed session', async () => {
      const { body: started } = await startFocus().expect(201);
      await a().patch(`/api/v1/sessions/${started.id}/complete`).expect(200);

      await a().patch(`/api/v1/sessions/${started.id}/complete`).expect(409);
    });

    it('answers 404 for another user session', async () => {
      const { body: started } = await startFocus(bob).expect(201);

      await a().patch(`/api/v1/sessions/${started.id}/pause`).expect(404);
      await a().patch(`/api/v1/sessions/${started.id}/cancel`).expect(404);
    });
  });

  describe('recovery after the app is closed', () => {
    it('returns the running session with the time that actually elapsed', async () => {
      const { body: started } = await startFocus(alice, { durationSec: 1800 }).expect(201);
      await ageSession(started.id, 10);

      // A cold start on the same device, or a first launch on another one.
      const recovered = await a().get('/api/v1/sessions/active').expect(200);

      expect(recovered.body.id).toBe(started.id);
      expect(recovered.body.status).toBe('RUNNING');
      expect(recovered.body.elapsedSec).toBeGreaterThanOrEqual(600);
      expect(recovered.body.remainingSec).toBeLessThanOrEqual(1200);
    });

    it('settles a session whose deadline passed while the app was closed', async () => {
      const { body: started } = await startFocus(alice, { durationSec: 600 }).expect(201);
      await ageSession(started.id, 30);

      await a().get('/api/v1/sessions/active').expect(204);

      const stored = await prisma.pomodoroSession.findUniqueOrThrow({ where: { id: started.id } });
      expect(stored.status).toBe('COMPLETED');
      // The end instant is the deadline, not the moment the sweep noticed.
      const expected = new Date(stored.startedAt.getTime() + 600_000).getTime();
      expect(stored.endedAt?.getTime()).toBe(expected);
    });

    it('does not expire a session that was left paused', async () => {
      const { body: started } = await startFocus(alice, { durationSec: 600 }).expect(201);
      await a().patch(`/api/v1/sessions/${started.id}/pause`).expect(200);
      await ageSession(started.id, 300);

      const active = await a().get('/api/v1/sessions/active').expect(200);

      expect(active.body.status).toBe('PAUSED');
      expect(active.body.remainingSec).toBeGreaterThan(0);
    });

    it('lets a new session start once the expired one is settled', async () => {
      const { body: started } = await startFocus(alice, { durationSec: 600 }).expect(201);
      await ageSession(started.id, 30);

      // No explicit cleanup call: starting settles the stale session first.
      await startFocus().expect(201);
    });
  });

  describe('history', () => {
    const seedFinished = async (count: number) => {
      await prisma.pomodoroSession.createMany({
        data: Array.from({ length: count }, (_, index) => ({
          userId: alice.id,
          kind: 'FOCUS' as const,
          status: 'COMPLETED' as const,
          startedAt: new Date(Date.now() - (index + 1) * 60 * MINUTE),
          durationSec: 1500,
          endedAt: new Date(Date.now() - (index + 1) * 60 * MINUTE + 1_500_000),
        })),
      });
    };

    it('returns an empty page for a new account', async () => {
      const response = await a().get('/api/v1/sessions').expect(200);

      expect(response.body).toEqual({ items: [], nextCursor: null });
    });

    it('excludes sessions that are still active', async () => {
      await startFocus().expect(201);

      const response = await a().get('/api/v1/sessions').expect(200);

      expect(response.body.items).toEqual([]);
    });

    it('paginates by cursor, most recent first', async () => {
      await seedFinished(5);

      const first = await a().get('/api/v1/sessions?limit=2').expect(200);
      expect(first.body.items).toHaveLength(2);
      expect(first.body.nextCursor).not.toBeNull();

      const second = await a()
        .get(`/api/v1/sessions?limit=2&cursor=${first.body.nextCursor}`)
        .expect(200);
      expect(second.body.items).toHaveLength(2);

      const ids = [...first.body.items, ...second.body.items].map((s: { id: string }) => s.id);
      expect(new Set(ids).size).toBe(4);

      const last = await a()
        .get(`/api/v1/sessions?limit=2&cursor=${second.body.nextCursor}`)
        .expect(200);
      expect(last.body.items).toHaveLength(1);
      expect(last.body.nextCursor).toBeNull();
    });

    it('filters by period', async () => {
      await seedFinished(5);
      const from = new Date(Date.now() - 150 * MINUTE).toISOString();

      const response = await a().get(`/api/v1/sessions?from=${from}`).expect(200);

      expect(response.body.items).toHaveLength(2);
    });

    it('never returns another user history', async () => {
      await seedFinished(3);

      const response = await b().get('/api/v1/sessions').expect(200);

      expect(response.body.items).toEqual([]);
    });
  });
});
