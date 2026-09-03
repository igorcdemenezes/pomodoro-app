import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/**
 * Translates database-level guarantees into HTTP semantics.
 *
 * The domain deliberately relies on constraints the database enforces, so those
 * violations are expected control flow, not internal errors. Without this filter
 * a lost race on the active-session index would surface as a 500.
 */
/** Presentable messages, keyed by the rule that was broken. */
const UNIQUE_MESSAGES: Record<string, string> = {
  SESSION_ALREADY_ACTIVE: 'You already have a session in progress.',
  PROJECT_NAME_TAKEN: 'You already have a project with this name.',
  EMAIL_ALREADY_REGISTERED: 'This email address is already registered.',
  DUPLICATE_MUTATION: 'This request was already processed.',
  UNIQUE_VIOLATION: 'A record with these values already exists.',
};

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    const { status, code, message } = this.translate(exception);

    if (status >= 500) {
      this.logger.error(`Unhandled Prisma error ${exception.code}`, exception.stack);
    }

    response.status(status).json({ statusCode: status, code, message });
  }

  private translate(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    code: string;
    message: string;
  } {
    switch (exception.code) {
      case 'P2002': {
        const code = this.uniqueViolationCode(exception);
        return { status: HttpStatus.CONFLICT, code, message: UNIQUE_MESSAGES[code] };
      }
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          code: 'FOREIGN_KEY_VIOLATION',
          message: 'A referenced record does not exist.',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          code: 'NOT_FOUND',
          message: 'Record not found.',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          code: 'DATABASE_ERROR',
          message: 'Unexpected database error.',
        };
    }
  }

  /**
   * Names the specific rule that was broken, so clients can react precisely.
   *
   * Prisma reports the offending *columns* in meta.target, not the index name —
   * for an expression index it reports the expression itself. Matching on the
   * model plus the columns is therefore the only reliable discriminator.
   */
  private uniqueViolationCode(exception: Prisma.PrismaClientKnownRequestError): string {
    const target = exception.meta?.target;
    const columns = Array.isArray(target)
      ? target.map(String)
      : typeof target === 'string'
        ? [target]
        : [];
    const model = typeof exception.meta?.modelName === 'string' ? exception.meta.modelName : '';
    const has = (fragment: string) => columns.some((column) => column.includes(fragment));

    if (model === 'PomodoroSession') {
      if (has('client_mutation_id')) return 'DUPLICATE_MUTATION';
      if (has('user_id')) return 'SESSION_ALREADY_ACTIVE';
    }

    if (model === 'Project' && has('name')) return 'PROJECT_NAME_TAKEN';
    if (has('email')) return 'EMAIL_ALREADY_REGISTERED';

    return 'UNIQUE_VIOLATION';
  }
}
