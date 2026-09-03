import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';

/**
 * Boots the application exactly as `main.ts` does, so a spec cannot pass
 * because the test harness is more permissive than production.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();

  return app;
}

export interface SignedInUser {
  id: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}

/** Registers a user and returns their tokens, so specs start from a real session. */
export async function signUp(app: INestApplication, email: string): Promise<SignedInUser> {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({ email, name: 'Test User', password: 'a-strong-password' })
    .expect(201);

  return {
    id: response.body.user.id,
    email: response.body.user.email,
    accessToken: response.body.accessToken,
    refreshToken: response.body.refreshToken,
  };
}

export const asUser = (app: INestApplication, user: SignedInUser) => ({
  get: (path: string) =>
    request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${user.accessToken}`),
  post: (path: string) =>
    request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${user.accessToken}`),
  patch: (path: string) =>
    request(app.getHttpServer()).patch(path).set('Authorization', `Bearer ${user.accessToken}`),
  delete: (path: string) =>
    request(app.getHttpServer()).delete(path).set('Authorization', `Bearer ${user.accessToken}`),
});
