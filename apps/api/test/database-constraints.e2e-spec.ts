import { SessionKind, SessionStatus, TaskStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { createUser, prisma, resetDatabase } from './prisma-test-client';

/**
 * These specs assert guarantees that belong to the database, not to a service.
 *
 * The distinction matters: a service check can be bypassed by a race, a bug or
 * a direct SQL session, and the requirement is that two simultaneous sessions
 * are impossible — not merely unlikely.
 */
describe('Database constraints', () => {
  beforeEach(resetDatabase);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  const startSession = (
    userId: string,
    overrides: Partial<Prisma.PomodoroSessionCreateInput> = {},
  ) =>
    prisma.pomodoroSession.create({
      data: {
        user: { connect: { id: userId } },
        kind: SessionKind.FOCUS,
        status: SessionStatus.RUNNING,
        startedAt: new Date(),
        durationSec: 1500,
        ...overrides,
      },
    });

  describe('one active session per user', () => {
    it('rejects a second active session for the same user', async () => {
      const user = await createUser('one@example.com');
      await startSession(user.id);

      await expect(startSession(user.id)).rejects.toMatchObject({ code: 'P2002' });
    });

    it('allows exactly one winner when two starts race', async () => {
      const user = await createUser('race@example.com');

      const results = await Promise.allSettled([startSession(user.id), startSession(user.id)]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      await expect(prisma.pomodoroSession.count({ where: { userId: user.id } })).resolves.toBe(1);
    });

    it('does not constrain different users', async () => {
      const [a, b] = await Promise.all([createUser('a@example.com'), createUser('b@example.com')]);

      await expect(Promise.all([startSession(a.id), startSession(b.id)])).resolves.toHaveLength(2);
    });

    it('frees the slot once the session finishes', async () => {
      const user = await createUser('finish@example.com');
      const session = await startSession(user.id);

      await prisma.pomodoroSession.update({
        where: { id: session.id },
        data: { status: SessionStatus.COMPLETED, endedAt: new Date() },
      });

      await expect(startSession(user.id)).resolves.toMatchObject({ status: SessionStatus.RUNNING });
    });

    it('still blocks while the session is only paused', async () => {
      const user = await createUser('paused@example.com');
      const session = await startSession(user.id);

      await prisma.pomodoroSession.update({
        where: { id: session.id },
        data: { status: SessionStatus.PAUSED, pausedAt: new Date() },
      });

      await expect(startSession(user.id)).rejects.toMatchObject({ code: 'P2002' });
    });
  });

  describe('session state consistency', () => {
    it('refuses a paused session without a pause instant', async () => {
      const user = await createUser('badpause@example.com');

      await expect(startSession(user.id, { status: SessionStatus.PAUSED })).rejects.toThrow(
        /session_paused_at_matches_status/,
      );
    });

    it('refuses a completed session without an end instant', async () => {
      const user = await createUser('badend@example.com');

      await expect(startSession(user.id, { status: SessionStatus.COMPLETED })).rejects.toThrow(
        /session_ended_at_matches_status/,
      );
    });

    it('refuses a non-positive duration', async () => {
      const user = await createUser('badduration@example.com');

      await expect(startSession(user.id, { durationSec: 0 })).rejects.toThrow(
        /session_duration_positive/,
      );
    });
  });

  describe('ownership and cascades', () => {
    it('removes everything belonging to a deleted user', async () => {
      const user = await createUser('cascade@example.com');
      const project = await prisma.project.create({
        data: { userId: user.id, name: 'Work', color: '#111111' },
      });
      await prisma.task.create({
        data: { userId: user.id, projectId: project.id, title: 'Task' },
      });
      await startSession(user.id);

      await prisma.user.delete({ where: { id: user.id } });

      await expect(prisma.project.count()).resolves.toBe(0);
      await expect(prisma.task.count()).resolves.toBe(0);
      await expect(prisma.pomodoroSession.count()).resolves.toBe(0);
    });

    it('keeps session history when its task is deleted', async () => {
      const user = await createUser('history@example.com');
      const task = await prisma.task.create({ data: { userId: user.id, title: 'Doomed' } });
      const session = await startSession(user.id, { task: { connect: { id: task.id } } });

      await prisma.task.delete({ where: { id: task.id } });

      await expect(
        prisma.pomodoroSession.findUnique({ where: { id: session.id } }),
      ).resolves.toMatchObject({ id: session.id, taskId: null });
    });
  });

  describe('projects and tasks', () => {
    it('rejects two active projects whose names differ only by case', async () => {
      const user = await createUser('projects@example.com');
      await prisma.project.create({ data: { userId: user.id, name: 'Work' } });

      await expect(
        prisma.project.create({ data: { userId: user.id, name: 'WORK' } }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('frees the name once the project is archived', async () => {
      const user = await createUser('archive@example.com');
      const project = await prisma.project.create({ data: { userId: user.id, name: 'Work' } });

      await prisma.project.update({
        where: { id: project.id },
        data: { archivedAt: new Date() },
      });

      await expect(
        prisma.project.create({ data: { userId: user.id, name: 'Work' } }),
      ).resolves.toMatchObject({ name: 'Work' });
    });

    it('refuses a colour that is not a hex triplet', async () => {
      const user = await createUser('colour@example.com');

      await expect(
        prisma.project.create({ data: { userId: user.id, name: 'Bad', color: 'red' } }),
      ).rejects.toThrow(/project_color_is_hex/);
    });

    it('refuses a done task without a completion instant', async () => {
      const user = await createUser('done@example.com');

      await expect(
        prisma.task.create({ data: { userId: user.id, title: 'T', status: TaskStatus.DONE } }),
      ).rejects.toThrow(/task_completed_at_matches_status/);
    });

    it('refuses a blank title', async () => {
      const user = await createUser('blank@example.com');

      await expect(prisma.task.create({ data: { userId: user.id, title: '   ' } })).rejects.toThrow(
        /task_title_not_blank/,
      );
    });
  });

  describe('refresh tokens', () => {
    it('refuses a revoked token without a reason', async () => {
      const user = await createUser('token@example.com');

      await expect(
        prisma.refreshToken.create({
          data: {
            userId: user.id,
            tokenHash: 'hash-1',
            expiresAt: new Date(Date.now() + 1000),
            revokedAt: new Date(),
          },
        }),
      ).rejects.toThrow(/refresh_token_reason_matches_revocation/);
    });

    it('refuses a live token that carries a reason', async () => {
      const user = await createUser('token2@example.com');

      await expect(
        prisma.refreshToken.create({
          data: {
            userId: user.id,
            tokenHash: 'hash-2',
            expiresAt: new Date(Date.now() + 1000),
            revokedReason: 'LOGOUT',
          },
        }),
      ).rejects.toThrow(/refresh_token_reason_matches_revocation/);
    });
  });

  describe('users', () => {
    it('refuses a non-lowercase email', async () => {
      await expect(createUser('MiXeD@example.com')).rejects.toThrow(/user_email_lowercase/);
    });

    it('refuses a duplicate email', async () => {
      await createUser('dup@example.com');

      await expect(createUser('dup@example.com')).rejects.toMatchObject({ code: 'P2002' });
    });

    it('refuses an unusable focus duration', async () => {
      await expect(
        prisma.user.create({
          data: {
            email: 'prefs@example.com',
            name: 'Prefs',
            passwordHash: 'x',
            focusDurationSec: 5,
          },
        }),
      ).rejects.toThrow(/user_focus_duration_in_range/);
    });
  });
});
