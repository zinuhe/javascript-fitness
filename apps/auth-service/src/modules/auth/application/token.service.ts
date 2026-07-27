import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthTokens, JwtAccessPayload } from '@fitness/contracts';
import type { AuthEnv } from '../../../config/env';

/**
 * Issues signed JWT access tokens and opaque refresh tokens. Refresh tokens are random
 * (not JWTs) and only their SHA-256 hash is persisted, so a DB leak can't reuse them.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AuthEnv, true>,
  ) {}

  async issueTokens(payload: JwtAccessPayload): Promise<{
    tokens: AuthTokens;
    refreshExpiresAt: Date;
  }> {
    const accessTtl = this.config.get('JWT_ACCESS_TTL', { infer: true });
    const refreshTtl = this.config.get('JWT_REFRESH_TTL', { infer: true });

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: accessTtl,
    });

    const refreshToken = randomBytes(48).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + refreshTtl * 1000);

    return {
      tokens: {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: accessTtl,
      },
      refreshExpiresAt,
    };
  }

  /** Stable hash used to store/look up refresh tokens without keeping the raw value. */
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
