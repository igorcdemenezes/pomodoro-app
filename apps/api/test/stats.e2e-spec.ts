import type { INestApplication } from '@nestjs/common';

import { asUser, createTestApp, signUp } from './app-harness';
import type { SignedInUser } from './app-harness';
import { prisma, resetDatabase } from './prisma-test-client';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

describe('Stats (e2e)', () => {
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

  /** A finished session that ran for `ranMinutes`, `daysAgo` days back. */
  const finished = (options: {
    user?: SignedInUser;
    daysAgo: number;
    ranMinutes: number;
    status?: 'COMPLETED' | 'CANCELLED';
    kind?: 'FOCUS' | 'SHORT_BREAK';
    taskId?: string;
    pausedMinutes?: number;
  }) => {
    const startedAt = new Date(Date.now() - options.daysAgo * DAY);
    const pausedMs = (options.pausedMinutes ?? 0) * MINUTE;

    return prisma.pomodoroSession.create({
      data: {
        userId: (options.user ?? alice).id,
        taskId: options.taskId ?? null,
        kind: options.kind ?? 'FOCUS',
        status: options.status ?? 'COMPLETED',
        startedAt,
        durationSec: 1500,
        pausedAccumulatedMs: pausedMs,
        endedAt: new Date(startedAt.getTime() + options.ranMinutes * MINUTE + pausedMs),
      },
    });
  };

  describe('summary', () => {
    it('returns zeros for an account with no history', async () => {
      const response = await a().get('/api/v1/stats/summary').expect(200);

      expect(response.body).toMatchObject({
        focusedSeconds: 0,
        completedSessions: 0,
        cancelledSessions: 0,
        completionRate: 0,
        currentStreakDays: 0,
      });
    });

    it('counts time actually run, not the nominal duration', async () => {
      // Finished early: 10 minutes of a 25-minute session.
      await finished({ daysAgo: 1, ranMinutes: 10 });

      const response = await a().get('/api/v1/stats/summary').expect(200);

      expect(response.body.focusedSeconds).toBe(600);
    });

    it('excludes time spent paused', async () => {
      await finished({ daysAgo: 1, ranMinutes: 20, pausedMinutes: 5 });

      const response = await a().get('/api/v1/stats/summary').expect(200);

      expect(response.body.focusedSeconds).toBe(1200);
    });

    it('ignores breaks and cancelled sessions in focused time', async () => {
      await finished({ daysAgo: 1, ranMinutes: 25 });
      await finished({ daysAgo: 1, ranMinutes: 5, kind: 'SHORT_BREAK' });
      await finished({ daysAgo: 1, ranMinutes: 8, status: 'CANCELLED' });

      const response = await a().get('/api/v1/stats/summary').expect(200);

      expect(response.body).toMatchObject({
        focusedSeconds: 1500,
        completedSessions: 1,
        cancelledSessions: 1,
      });
    });

    it('computes the completion rate over attempted focus sessions', async () => {
      await finished({ daysAgo: 1, ranMinutes: 25 });
      await finished({ daysAgo: 1, ranMinutes: 25 });
      await finished({ daysAgo: 1, ranMinutes: 25 });
      await finished({ daysAgo: 1, ranMinutes: 3, status: 'CANCELLED' });

      const response = await a().get('/api/v1/stats/summary').expect(200);

      expect(response.body.completionRate).toBe(0.75);
    });

    it('honours the requested range', async () => {
      await finished({ daysAgo: 2, ranMinutes: 25 });
      await finished({ daysAgo: 40, ranMinutes: 25 });

      const week = await a().get('/api/v1/stats/summary?range=week').expect(200);
      const all = await a().get('/api/v1/stats/summary?range=all').expect(200);

      expect(week.body.completedSessions).toBe(1);
      expect(all.body.completedSessions).toBe(2);
    });

    it('never mixes in another user history', async () => {
      await finished({ user: bob, daysAgo: 1, ranMinutes: 25 });

      const response = await a().get('/api/v1/stats/summary').expect(200);

      expect(response.body.completedSessions).toBe(0);
      const bobResponse = await b().get('/api/v1/stats/summary').expect(200);
      expect(bobResponse.body.completedSessions).toBe(1);
    });

    it('rejects an unknown range and an invalid time zone', async () => {
      await a().get('/api/v1/stats/summary?range=fortnight').expect(400);
      await a().get('/api/v1/stats/summary?timeZone=Mars/Olympus').expect(400);
    });

    describe('streak', () => {
      it('counts consecutive days ending today', async () => {
        await finished({ daysAgo: 0, ranMinutes: 25 });
        await finished({ daysAgo: 1, ranMinutes: 25 });
        await finished({ daysAgo: 2, ranMinutes: 25 });

        const response = await a().get('/api/v1/stats/summary').expect(200);

        expect(response.body.currentStreakDays).toBe(3);
      });

      it('breaks on a missing day', async () => {
        await finished({ daysAgo: 0, ranMinutes: 25 });
        await finished({ daysAgo: 1, ranMinutes: 25 });
        await finished({ daysAgo: 3, ranMinutes: 25 });

        const response = await a().get('/api/v1/stats/summary').expect(200);

        expect(response.body.currentStreakDays).toBe(2);
      });

      it('survives today being empty, counting up to yesterday', async () => {
        await finished({ daysAgo: 1, ranMinutes: 25 });
        await finished({ daysAgo: 2, ranMinutes: 25 });

        const response = await a().get('/api/v1/stats/summary').expect(200);

        expect(response.body.currentStreakDays).toBe(2);
      });

      it('is zero once the last session is older than yesterday', async () => {
        await finished({ daysAgo: 5, ranMinutes: 25 });

        const response = await a().get('/api/v1/stats/summary').expect(200);

        expect(response.body.currentStreakDays).toBe(0);
      });
    });
  });

  describe('daily series', () => {
    it('returns a point per day including empty ones', async () => {
      await finished({ daysAgo: 1, ranMinutes: 25 });

      const response = await a().get('/api/v1/stats/daily').expect(200);

      expect(response.body).toHaveLength(14);
      expect(response.body.every((p: { day: string }) => /^\d{4}-\d{2}-\d{2}$/.test(p.day))).toBe(
        true,
      );

      const total = response.body.reduce(
        (sum: number, point: { focusedSeconds: number }) => sum + point.focusedSeconds,
        0,
      );
      expect(total).toBe(1500);
      expect(
        response.body.filter((p: { focusedSeconds: number }) => p.focusedSeconds === 0),
      ).toHaveLength(13);
    });

    it('returns days in ascending order', async () => {
      const response = await a().get('/api/v1/stats/daily').expect(200);

      const days = response.body.map((p: { day: string }) => p.day);
      expect([...days].sort()).toEqual(days);
    });

    it('honours an explicit window', async () => {
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 2 * DAY).toISOString().slice(0, 10);

      const response = await a().get(`/api/v1/stats/daily?from=${from}&to=${to}`).expect(200);

      expect(response.body).toHaveLength(3);
    });

    it('rejects a reversed or excessive range', async () => {
      await a().get('/api/v1/stats/daily?from=2026-09-03&to=2026-09-01').expect(400);
      await a().get('/api/v1/stats/daily?from=2000-01-01&to=2026-09-03').expect(400);
    });
  });

  describe('breakdown by project', () => {
    it('groups focused time by project and keeps unfiled sessions separate', async () => {
      const { body: project } = await a()
        .post('/api/v1/projects')
        .send({ name: 'Deep Work', color: '#123456' })
        .expect(201);
      const { body: task } = await a()
        .post('/api/v1/tasks')
        .send({ title: 'Filed', projectId: project.id })
        .expect(201);

      await finished({ daysAgo: 1, ranMinutes: 25, taskId: task.id });
      await finished({ daysAgo: 1, ranMinutes: 10 });

      const response = await a().get('/api/v1/stats/by-project').expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({
        projectId: project.id,
        projectName: 'Deep Work',
        color: '#123456',
        focusedSeconds: 1500,
        completedSessions: 1,
      });
      expect(response.body[1]).toMatchObject({
        projectId: null,
        projectName: 'No project',
        focusedSeconds: 600,
      });
    });

    it('keeps history after the project is archived', async () => {
      const { body: project } = await a()
        .post('/api/v1/projects')
        .send({ name: 'Archived' })
        .expect(201);
      const { body: task } = await a()
        .post('/api/v1/tasks')
        .send({ title: 'Filed', projectId: project.id })
        .expect(201);
      await finished({ daysAgo: 1, ranMinutes: 25, taskId: task.id });

      await a().delete(`/api/v1/projects/${project.id}`).expect(200);

      const response = await a().get('/api/v1/stats/by-project').expect(200);
      expect(response.body[0]).toMatchObject({ projectName: 'Archived', focusedSeconds: 1500 });
    });

    it('is empty for a new account', async () => {
      const response = await a().get('/api/v1/stats/by-project').expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('authentication', () => {
    it('refuses every stats route without a token', async () => {
      const { default: request } = await import('supertest');
      const server = app.getHttpServer();

      await request(server).get('/api/v1/stats/summary').expect(401);
      await request(server).get('/api/v1/stats/daily').expect(401);
      await request(server).get('/api/v1/stats/by-project').expect(401);
    });
  });
});
