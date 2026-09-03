import { createHash, randomBytes } from 'node:crypto';

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RefreshTokenRevokedReason } from '@prisma/client';
import type { User } from '@prisma/client';

import { hashPassword, verifyPassword } from '../common/crypto/password';
import { PrismaService } from '../prisma/prisma.service';
import { toUserProfile } from '../users/user.mapper';
import type { AuthResponseDto } from './dto/auth-response.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    // The unique index on users.email is the real guarantee; a duplicate email
    // surfaces as P2002 and the Prisma filter turns it into 409.
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash: await hashPassword(dto.password),
      },
    });

    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Hash even when the user does not exist, so response time does not reveal
    // which emails are registered.
    const encoded = user?.passwordHash ?? (await this.dummyHash());
    const valid = await verifyPassword(dto.password, encoded);

    if (!user || !valid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect.',
      });
    }

    return this.issueTokens(user, dto.deviceLabel);
  }

  /**
   * Rotates the refresh token: the presented one is revoked and a new one
   * issued, inside a single transaction so a crash cannot leave both valid.
   *
   * Presenting an already-revoked token means it leaked or was replayed, so
   * every token for that user is revoked and the session ends everywhere.
   */
  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    const tokenHash = this.hashToken(refreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid.',
      });
    }

    if (stored.revokedAt) {
      // Only a token retired by rotation is evidence of theft. One retired by
      // an explicit logout being presented again is a client retrying, and must
      // not end the user's sessions on their other devices.
      if (stored.revokedReason === RefreshTokenRevokedReason.ROTATED) {
        this.logger.warn(`Replay of a rotated refresh token for user ${stored.userId}`);
        await this.prisma.refreshToken.updateMany({
          where: { userId: stored.userId, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: RefreshTokenRevokedReason.REUSE_DETECTED },
        });

        throw new UnauthorizedException({
          code: 'REFRESH_TOKEN_REUSED',
          message: 'Session ended for security reasons. Sign in again.',
        });
      }

      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is no longer valid.',
      });
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_EXPIRED',
        message: 'Session expired. Sign in again.',
      });
    }

    const { token, hash, expiresAt } = this.createRefreshToken();

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date(), revokedReason: RefreshTokenRevokedReason.ROTATED },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: stored.userId,
          tokenHash: hash,
          expiresAt,
          deviceLabel: stored.deviceLabel,
        },
      }),
    ]);

    return this.buildResponse(stored.user, token);
  }

  /** Revokes only the presented token, so other devices stay signed in. */
  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: RefreshTokenRevokedReason.LOGOUT },
    });
  }

  private async issueTokens(user: User, deviceLabel?: string): Promise<AuthResponseDto> {
    const { token, hash, expiresAt } = this.createRefreshToken();

    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: hash, expiresAt, deviceLabel },
    });

    return this.buildResponse(user, token);
  }

  private async buildResponse(user: User, refreshToken: string): Promise<AuthResponseDto> {
    const expiresIn = this.config.get<number>('JWT_ACCESS_TTL_SEC', 900);

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email },
      { secret: this.config.getOrThrow<string>('JWT_SECRET'), expiresIn },
    );

    return { accessToken, refreshToken, expiresIn, user: toUserProfile(user) };
  }

  /**
   * Opaque, not a JWT: a refresh token must be revocable, and revocation is
   * only meaningful if the server holds state. Only its hash is stored, so a
   * database leak does not hand over live sessions.
   */
  private createRefreshToken(): { token: string; hash: string; expiresAt: Date } {
    const token = randomBytes(48).toString('base64url');
    const days = this.config.get<number>('REFRESH_TOKEN_TTL_DAYS', 30);

    return {
      token,
      hash: this.hashToken(token),
      expiresAt: new Date(Date.now() + days * DAY_MS),
    };
  }

  private hashToken(token: string): string {
    // SHA-256 is right here: the token is 48 random bytes, so it is not
    // guessable and does not need a slow KDF the way a password does.
    return createHash('sha256').update(token).digest('base64url');
  }

  private dummyHashCache?: string;

  private async dummyHash(): Promise<string> {
    this.dummyHashCache ??= await hashPassword(randomBytes(16).toString('hex'));
    return this.dummyHashCache;
  }
}
