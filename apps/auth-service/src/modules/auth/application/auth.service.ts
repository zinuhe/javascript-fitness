import { Inject, Injectable } from '@nestjs/common';
import { ConflictError, UnauthorizedError } from '@fitness/common';
import type { AuthResponse, UserProfile } from '@fitness/contracts';
import { USER_REPOSITORY, type UserRepository } from '../domain/user.repository';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from '../domain/refresh-token.repository';
import type { UserEntity } from '../domain/user.entity';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

/** Application use cases for authentication. Pure orchestration over ports + services. */
@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async register(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<AuthResponse> {
    const email = input.email.toLowerCase().trim();
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictError('Email is already registered', 'user.email_taken');
    }

    const passwordHash = await this.passwords.hash(input.password);
    const user = await this.users.create({
      email,
      displayName: input.displayName.trim(),
      passwordHash,
    });

    return this.buildAuthResponse(user);
  }

  async login(input: { email: string; password: string }): Promise<AuthResponse> {
    const email = input.email.toLowerCase().trim();
    const user = await this.users.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials', 'auth.invalid_credentials');
    }

    const valid = await this.passwords.verify(user.passwordHash, input.password);
    if (!valid) {
      throw new UnauthorizedError('Invalid credentials', 'auth.invalid_credentials');
    }

    return this.buildAuthResponse(user);
  }

  /** Rotating refresh: the presented token is revoked and a fresh pair is issued. */
  async refresh(refreshToken: string): Promise<AuthResponse> {
    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    const stored = await this.refreshTokens.findByHash(tokenHash);

    if (!stored || stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError('Invalid refresh token', 'auth.invalid_refresh_token');
    }

    const user = await this.users.findById(stored.userId);
    if (!user) {
      throw new UnauthorizedError('Invalid refresh token', 'auth.invalid_refresh_token');
    }

    await this.refreshTokens.revoke(stored.id);
    return this.buildAuthResponse(user);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    const stored = await this.refreshTokens.findByHash(tokenHash);
    if (stored && !stored.revokedAt) {
      await this.refreshTokens.revoke(stored.id);
    }
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedError('User not found', 'auth.user_not_found');
    }
    return this.toProfile(user);
  }

  private async buildAuthResponse(user: UserEntity): Promise<AuthResponse> {
    const { tokens, refreshExpiresAt } = await this.tokens.issueTokens({
      sub: user.id,
      email: user.email,
    });

    await this.refreshTokens.create({
      userId: user.id,
      tokenHash: this.tokens.hashRefreshToken(tokens.refreshToken),
      expiresAt: refreshExpiresAt,
    });

    return { user: this.toProfile(user), tokens };
  }

  private toProfile(user: UserEntity): UserProfile {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
