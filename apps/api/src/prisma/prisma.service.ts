import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Unique-violation code raised by PostgreSQL, surfaced by Prisma as P2002.
 * The domain relies on it: the partial unique index on active sessions is what
 * makes "one running session per user" hold under concurrent requests.
 */
export const UNIQUE_VIOLATION = 'P2002';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to the database');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Cheap readiness probe: proves the connection is usable, not merely open. */
  async ping(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Database ping failed', error instanceof Error ? error.stack : undefined);
      return false;
    }
  }

  /**
   * True when the error is a unique-constraint violation on the given index.
   * Callers translate it into a domain conflict instead of leaking Prisma
   * internals into HTTP responses.
   */
  static isUniqueViolation(error: unknown, constraint?: string): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
    if (error.code !== UNIQUE_VIOLATION) return false;
    if (!constraint) return true;

    const target = error.meta?.target;
    if (typeof target === 'string') return target === constraint;
    if (Array.isArray(target)) return target.includes(constraint);
    return false;
  }
}
