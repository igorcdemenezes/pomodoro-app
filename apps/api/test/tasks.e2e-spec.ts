import type { INestApplication } from '@nestjs/common';

import { asUser, createTestApp, signUp } from './app-harness';
import type { SignedInUser } from './app-harness';
import { prisma, resetDatabase } from './prisma-test-client';

describe('Tasks (e2e)', () => {
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

  const createProject = async (name: string, user = alice) => {
    const response = await asUser(app, user).post('/api/v1/projects').send({ name }).expect(201);
    return response.body.id as string;
  };

  describe('creating', () => {
    it('creates an unfiled task with sensible defaults', async () => {
      const response = await a().post('/api/v1/tasks').send({ title: 'Inbox zero' }).expect(201);

      expect(response.body).toMatchObject({
        title: 'Inbox zero',
        projectId: null,
        status: 'TODO',
        estimatedPomodoros: 1,
        completedPomodoros: 0,
        completedAt: null,
      });
    });

    it('files a task under a project of the same owner', async () => {
      const projectId = await createProject('Deep Work');

      const response = await a()
        .post('/api/v1/tasks')
        .send({ title: 'ADR', projectId })
        .expect(201);

      expect(response.body.projectId).toBe(projectId);
    });

    it('refuses to file a task under another user project', async () => {
      const bobProject = await createProject('Bob Work', bob);

      const response = await a()
        .post('/api/v1/tasks')
        .send({ title: 'Trespass', projectId: bobProject })
        .expect(404);

      expect(response.body.code).toBe('PROJECT_NOT_FOUND');
    });

    it('sets the completion instant when created already done', async () => {
      const response = await a()
        .post('/api/v1/tasks')
        .send({ title: 'Already done', status: 'DONE' })
        .expect(201);

      expect(response.body.completedAt).not.toBeNull();
    });

    it('rejects an estimate outside the allowed range', async () => {
      await a()
        .post('/api/v1/tasks')
        .send({ title: 'Too big', estimatedPomodoros: 500 })
        .expect(400);
    });

    it('rejects a blank title', async () => {
      await a().post('/api/v1/tasks').send({ title: '  ' }).expect(400);
    });
  });

  describe('listing and filtering', () => {
    it('never returns another user tasks', async () => {
      await b().post('/api/v1/tasks').send({ title: 'Bob task' }).expect(201);
      await a().post('/api/v1/tasks').send({ title: 'Alice task' }).expect(201);

      const response = await a().get('/api/v1/tasks').expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Alice task');
    });

    it('filters by project', async () => {
      const projectId = await createProject('Filtered');
      await a().post('/api/v1/tasks').send({ title: 'In project', projectId }).expect(201);
      await a().post('/api/v1/tasks').send({ title: 'Unfiled' }).expect(201);

      const response = await a().get(`/api/v1/tasks?projectId=${projectId}`).expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('In project');
    });

    it('filters by status', async () => {
      await a().post('/api/v1/tasks').send({ title: 'Open' }).expect(201);
      await a().post('/api/v1/tasks').send({ title: 'Closed', status: 'DONE' }).expect(201);

      const response = await a().get('/api/v1/tasks?status=DONE').expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Closed');
    });

    it('rejects an unknown status value', async () => {
      await a().get('/api/v1/tasks?status=SOMEDAY').expect(400);
    });
  });

  describe('updating', () => {
    it('derives the completion instant from the status', async () => {
      const { body: task } = await a().post('/api/v1/tasks').send({ title: 'Work' }).expect(201);

      const done = await a().patch(`/api/v1/tasks/${task.id}`).send({ status: 'DONE' }).expect(200);
      expect(done.body.completedAt).not.toBeNull();

      const reopened = await a()
        .patch(`/api/v1/tasks/${task.id}`)
        .send({ status: 'TODO' })
        .expect(200);
      expect(reopened.body.completedAt).toBeNull();
    });

    it('ignores a completion instant sent by the client', async () => {
      const { body: task } = await a().post('/api/v1/tasks').send({ title: 'Work' }).expect(201);

      await a()
        .patch(`/api/v1/tasks/${task.id}`)
        .send({ status: 'DONE', completedAt: '1999-01-01T00:00:00.000Z' })
        .expect(400);
    });

    it('moves a task between projects and unfiles it', async () => {
      const first = await createProject('First');
      const second = await createProject('Second');
      const { body: task } = await a()
        .post('/api/v1/tasks')
        .send({ title: 'Movable', projectId: first })
        .expect(201);

      const moved = await a()
        .patch(`/api/v1/tasks/${task.id}`)
        .send({ projectId: second })
        .expect(200);
      expect(moved.body.projectId).toBe(second);

      const unfiled = await a()
        .patch(`/api/v1/tasks/${task.id}`)
        .send({ projectId: null })
        .expect(200);
      expect(unfiled.body.projectId).toBeNull();
    });

    it('answers 404 for another user task', async () => {
      const { body: task } = await b().post('/api/v1/tasks').send({ title: 'Bob' }).expect(201);

      await a().patch(`/api/v1/tasks/${task.id}`).send({ title: 'Stolen' }).expect(404);
      await a().get(`/api/v1/tasks/${task.id}`).expect(404);
      await a().delete(`/api/v1/tasks/${task.id}`).expect(404);
    });
  });

  describe('deleting', () => {
    it('deletes a task and keeps its session history detached', async () => {
      const { body: task } = await a().post('/api/v1/tasks').send({ title: 'Doomed' }).expect(201);

      await prisma.pomodoroSession.create({
        data: {
          userId: alice.id,
          taskId: task.id,
          kind: 'FOCUS',
          status: 'COMPLETED',
          startedAt: new Date(Date.now() - 1_500_000),
          durationSec: 1500,
          endedAt: new Date(),
        },
      });

      await a().delete(`/api/v1/tasks/${task.id}`).expect(204);

      const sessions = await prisma.pomodoroSession.findMany({ where: { userId: alice.id } });
      expect(sessions).toHaveLength(1);
      expect(sessions[0].taskId).toBeNull();
    });

    it('refuses to delete a task with a session in progress', async () => {
      const { body: task } = await a().post('/api/v1/tasks').send({ title: 'Busy' }).expect(201);

      await prisma.pomodoroSession.create({
        data: {
          userId: alice.id,
          taskId: task.id,
          kind: 'FOCUS',
          status: 'RUNNING',
          startedAt: new Date(),
          durationSec: 1500,
        },
      });

      const response = await a().delete(`/api/v1/tasks/${task.id}`).expect(400);
      expect(response.body.code).toBe('TASK_HAS_ACTIVE_SESSION');
    });
  });

  describe('completed pomodoro count', () => {
    it('counts only completed focus sessions', async () => {
      const { body: task } = await a().post('/api/v1/tasks').send({ title: 'Counted' }).expect(201);

      await prisma.pomodoroSession.createMany({
        data: [
          {
            userId: alice.id,
            taskId: task.id,
            kind: 'FOCUS',
            status: 'COMPLETED',
            startedAt: new Date(Date.now() - 3_000_000),
            durationSec: 1500,
            endedAt: new Date(Date.now() - 1_500_000),
          },
          {
            userId: alice.id,
            taskId: task.id,
            kind: 'FOCUS',
            status: 'CANCELLED',
            startedAt: new Date(Date.now() - 5_000_000),
            durationSec: 1500,
            endedAt: new Date(Date.now() - 4_900_000),
          },
          {
            userId: alice.id,
            taskId: task.id,
            kind: 'SHORT_BREAK',
            status: 'COMPLETED',
            startedAt: new Date(Date.now() - 900_000),
            durationSec: 300,
            endedAt: new Date(Date.now() - 600_000),
          },
        ],
      });

      const response = await a().get(`/api/v1/tasks/${task.id}`).expect(200);

      expect(response.body.completedPomodoros).toBe(1);
    });
  });
});
