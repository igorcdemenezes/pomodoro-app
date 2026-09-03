import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { prisma, resetDatabase } from './prisma-test-client';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  const credentials = {
    email: 'ada@example.com',
    name: 'Ada Lovelace',
    password: 'a-strong-password',
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new PrismaExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  beforeEach(resetDatabase);

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const http = () => request(app.getHttpServer());
  const register = (overrides: Partial<typeof credentials> = {}) =>
    http()
      .post('/api/v1/auth/register')
      .send({ ...credentials, ...overrides });

  describe('registration', () => {
    it('creates an account and returns tokens', async () => {
      const response = await register().expect(201);

      expect(response.body).toMatchObject({
        user: { email: credentials.email, name: credentials.name, focusDurationSec: 1500 },
        expiresIn: 900,
      });
      expect(typeof response.body.accessToken).toBe('string');
      expect(typeof response.body.refreshToken).toBe('string');
    });

    it('never exposes the password hash', async () => {
      const response = await register().expect(201);

      expect(JSON.stringify(response.body)).not.toContain('scrypt$');
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('normalises the email so the same address cannot register twice', async () => {
      await register().expect(201);

      const response = await register({ email: 'ADA@Example.com  ' }).expect(409);

      expect(response.body).toMatchObject({
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'This email address is already registered.',
      });
    });

    it('rejects a short password', async () => {
      await register({ password: 'short' }).expect(400);
    });

    it('rejects an invalid email', async () => {
      await register({ email: 'not-an-email' }).expect(400);
    });

    it('rejects properties the DTO does not declare', async () => {
      await http()
        .post('/api/v1/auth/register')
        .send({ ...credentials, isAdmin: true })
        .expect(400);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await register().expect(201);
    });

    it('returns tokens for correct credentials', async () => {
      const response = await http()
        .post('/api/v1/auth/login')
        .send({ email: credentials.email, password: credentials.password })
        .expect(200);

      expect(response.body.user.email).toBe(credentials.email);
    });

    it('rejects a wrong password', async () => {
      const response = await http()
        .post('/api/v1/auth/login')
        .send({ email: credentials.email, password: 'wrong-password' })
        .expect(401);

      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('does not reveal whether an email is registered', async () => {
      const unknown = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: credentials.password })
        .expect(401);

      expect(unknown.body.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('protected routes', () => {
    it('refuses a request without a token', async () => {
      const response = await http().get('/api/v1/me').expect(401);

      expect(response.body.code).toBe('MISSING_ACCESS_TOKEN');
    });

    it('refuses a malformed token', async () => {
      const response = await http()
        .get('/api/v1/me')
        .set('Authorization', 'Bearer not-a-jwt')
        .expect(401);

      expect(response.body.code).toBe('INVALID_ACCESS_TOKEN');
    });

    it('refuses a token signed with the wrong secret', async () => {
      // header.payload.signature crafted with a different key
      const forged =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmb3JnZWQiLCJlbWFpbCI6ImZAZS5jb20ifQ.' +
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

      await http().get('/api/v1/me').set('Authorization', `Bearer ${forged}`).expect(401);
    });

    it('returns the profile of the token owner', async () => {
      const { body } = await register().expect(201);

      const response = await http()
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({ id: body.user.id, email: credentials.email });
    });

    it('updates preferences within the allowed range', async () => {
      const { body } = await register().expect(201);

      const response = await http()
        .patch('/api/v1/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .send({ focusDurationSec: 3000, name: 'Ada L.' })
        .expect(200);

      expect(response.body).toMatchObject({ focusDurationSec: 3000, name: 'Ada L.' });
    });

    it('rejects a focus duration outside the allowed range', async () => {
      const { body } = await register().expect(201);

      await http()
        .patch('/api/v1/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .send({ focusDurationSec: 5 })
        .expect(400);
    });
  });

  describe('refresh token rotation', () => {
    it('issues a new pair and invalidates the presented token', async () => {
      const { body } = await register().expect(201);

      const rotated = await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: body.refreshToken })
        .expect(200);

      expect(rotated.body.refreshToken).not.toBe(body.refreshToken);

      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rotated.body.refreshToken })
        .expect(200);
    });

    it('ends every session when a revoked token is replayed', async () => {
      const { body } = await register().expect(201);

      const rotated = await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: body.refreshToken })
        .expect(200);

      // Replaying the original token means it leaked.
      const replay = await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: body.refreshToken })
        .expect(401);

      expect(replay.body.code).toBe('REFRESH_TOKEN_REUSED');

      // The token issued by the legitimate rotation is revoked as well.
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rotated.body.refreshToken })
        .expect(401);
    });

    it('rejects an unknown refresh token', async () => {
      const response = await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'a'.repeat(64) })
        .expect(401);

      expect(response.body.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('rejects an expired refresh token', async () => {
      const { body } = await register().expect(201);

      await prisma.refreshToken.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const response = await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: body.refreshToken })
        .expect(401);

      expect(response.body.code).toBe('REFRESH_TOKEN_EXPIRED');
    });
  });

  describe('logout', () => {
    it('signs out one device and leaves the others signed in', async () => {
      await register().expect(201);

      const phone = await http()
        .post('/api/v1/auth/login')
        .send({ email: credentials.email, password: credentials.password, deviceLabel: 'Phone' })
        .expect(200);
      const laptop = await http()
        .post('/api/v1/auth/login')
        .send({ email: credentials.email, password: credentials.password, deviceLabel: 'Laptop' })
        .expect(200);

      await http()
        .post('/api/v1/auth/logout')
        .send({ refreshToken: phone.body.refreshToken })
        .expect(204);

      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: phone.body.refreshToken })
        .expect(401);

      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: laptop.body.refreshToken })
        .expect(200);
    });
  });
});
