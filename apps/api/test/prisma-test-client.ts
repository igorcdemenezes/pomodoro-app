import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

/**
 * Truncating with CASCADE and RESTART IDENTITY leaves the schema — and every
 * constraint under test — in place, unlike dropping and recreating it.
 */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "pomodoro_sessions", "tasks", "projects", "refresh_tokens", "users" RESTART IDENTITY CASCADE',
  );
}

export async function createUser(email: string) {
  return prisma.user.create({
    data: { email, name: 'Test User', passwordHash: 'scrypt$65536$8$1$c2FsdA$aGFzaA' },
  });
}
