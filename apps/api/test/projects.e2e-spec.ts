import type { INestApplication } from '@nestjs/common';

import { asUser, createTestApp, signUp } from './app-harness';
import type { SignedInUser } from './app-harness';
import { prisma, resetDatabase } from './prisma-test-client';

describe('Projects (e2e)', () => {
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

  describe('creating', () => {
    it('creates a project with a default colour', async () => {
      const response = await a().post('/api/v1/projects').send({ name: 'Deep Work' }).expect(201);

      expect(response.body).toMatchObject({
        name: 'Deep Work',
        color: '#6E56CF',
        archivedAt: null,
        taskCount: 0,
        openTaskCount: 0,
      });
    });

    it('trims the name', async () => {
      const response = await a().post('/api/v1/projects').send({ name: '  Studies  ' }).expect(201);

      expect(response.body.name).toBe('Studies');
    });

    it('rejects a duplicate active name regardless of case', async () => {
      await a().post('/api/v1/projects').send({ name: 'Work' }).expect(201);

      const response = await a().post('/api/v1/projects').send({ name: 'WORK' }).expect(409);

      expect(response.body).toMatchObject({
        code: 'PROJECT_NAME_TAKEN',
        message: 'You already have a project with this name.',
      });
    });

    it('lets a different user reuse the same name', async () => {
      await a().post('/api/v1/projects').send({ name: 'Work' }).expect(201);

      await b().post('/api/v1/projects').send({ name: 'Work' }).expect(201);
    });

    it('rejects a colour that is not a hex triplet', async () => {
      await a().post('/api/v1/projects').send({ name: 'Bad', color: 'red' }).expect(400);
    });

    it('rejects a blank name', async () => {
      await a().post('/api/v1/projects').send({ name: '   ' }).expect(400);
    });
  });

  describe('listing', () => {
    it('returns an empty list for a new account', async () => {
      const response = await a().get('/api/v1/projects').expect(200);

      expect(response.body).toEqual([]);
    });

    it('never returns another user projects', async () => {
      await b().post('/api/v1/projects').send({ name: 'Bob Work' }).expect(201);
      await a().post('/api/v1/projects').send({ name: 'Alice Work' }).expect(201);

      const response = await a().get('/api/v1/projects').expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Alice Work');
    });

    it('counts open and total tasks without an extra query per project', async () => {
      const { body: project } = await a()
        .post('/api/v1/projects')
        .send({ name: 'Counting' })
        .expect(201);

      await a().post('/api/v1/tasks').send({ title: 'One', projectId: project.id }).expect(201);
      await a().post('/api/v1/tasks').send({ title: 'Two', projectId: project.id }).expect(201);
      await a()
        .post('/api/v1/tasks')
        .send({ title: 'Done', projectId: project.id, status: 'DONE' })
        .expect(201);

      const response = await a().get('/api/v1/projects').expect(200);

      expect(response.body[0]).toMatchObject({ taskCount: 3, openTaskCount: 2 });
    });

    it('hides archived projects unless asked', async () => {
      const { body: project } = await a()
        .post('/api/v1/projects')
        .send({ name: 'Old' })
        .expect(201);
      await a().delete(`/api/v1/projects/${project.id}`).expect(200);

      await expect(a().get('/api/v1/projects').expect(200)).resolves.toMatchObject({ body: [] });

      const withArchived = await a().get('/api/v1/projects?includeArchived=true').expect(200);
      expect(withArchived.body).toHaveLength(1);
    });
  });

  describe('ownership', () => {
    it('answers 404 rather than 403 for another user project', async () => {
      const { body: project } = await b()
        .post('/api/v1/projects')
        .send({ name: 'Bob Only' })
        .expect(201);

      const response = await a().get(`/api/v1/projects/${project.id}`).expect(404);
      expect(response.body.code).toBe('PROJECT_NOT_FOUND');

      await a().patch(`/api/v1/projects/${project.id}`).send({ name: 'Stolen' }).expect(404);
      await a().delete(`/api/v1/projects/${project.id}`).expect(404);
    });

    it('rejects a malformed id before reaching the database', async () => {
      await a().get('/api/v1/projects/not-a-uuid').expect(400);
    });
  });

  describe('archiving', () => {
    it('archives instead of deleting, keeping the project readable', async () => {
      const { body: project } = await a()
        .post('/api/v1/projects')
        .send({ name: 'Archive Me' })
        .expect(201);

      const archived = await a().delete(`/api/v1/projects/${project.id}`).expect(200);
      expect(archived.body.archivedAt).not.toBeNull();

      await a().get(`/api/v1/projects/${project.id}`).expect(200);
    });

    it('frees the name once archived, and restoring is possible', async () => {
      const { body: project } = await a()
        .post('/api/v1/projects')
        .send({ name: 'Work' })
        .expect(201);
      await a().delete(`/api/v1/projects/${project.id}`).expect(200);

      await a().post('/api/v1/projects').send({ name: 'Work' }).expect(201);

      // Restoring would now collide with the live project of the same name.
      await a().patch(`/api/v1/projects/${project.id}`).send({ archived: false }).expect(409);
    });

    it('keeps tasks when their project is archived', async () => {
      const { body: project } = await a()
        .post('/api/v1/projects')
        .send({ name: 'Keeps Tasks' })
        .expect(201);
      await a()
        .post('/api/v1/tasks')
        .send({ title: 'Survivor', projectId: project.id })
        .expect(201);

      await a().delete(`/api/v1/projects/${project.id}`).expect(200);

      const tasks = await a().get('/api/v1/tasks').expect(200);
      expect(tasks.body).toHaveLength(1);
    });
  });
});
