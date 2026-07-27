import { ConflictError, UnauthorizedError } from '@fitness/common';
import { AuthService } from './auth.service';
import type { UserRepository } from '../domain/user.repository';
import type { RefreshTokenRepository } from '../domain/refresh-token.repository';
import type { UserEntity, RefreshTokenEntity } from '../domain/user.entity';
import type { PasswordService } from './password.service';
import type { TokenService } from './token.service';

const buildUser = (over: Partial<UserEntity> = {}): UserEntity => ({
  id: 'user-1',
  email: 'alex@example.com',
  displayName: 'Alex',
  passwordHash: 'hashed',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...over,
});

describe('AuthService', () => {
  let users: jest.Mocked<UserRepository>;
  let refreshTokens: jest.Mocked<RefreshTokenRepository>;
  let passwords: jest.Mocked<PasswordService>;
  let tokens: jest.Mocked<TokenService>;
  let service: AuthService;

  beforeEach(() => {
    users = {
      create: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
    };
    refreshTokens = {
      create: jest.fn().mockResolvedValue({} as RefreshTokenEntity),
      findByHash: jest.fn(),
      revoke: jest.fn(),
      revokeAllForUser: jest.fn(),
    };
    passwords = { hash: jest.fn(), verify: jest.fn() } as unknown as jest.Mocked<PasswordService>;
    tokens = {
      issueTokens: jest.fn().mockResolvedValue({
        tokens: {
          accessToken: 'access',
          refreshToken: 'refresh',
          tokenType: 'Bearer',
          expiresIn: 900,
        },
        refreshExpiresAt: new Date('2026-02-01T00:00:00Z'),
      }),
      hashRefreshToken: jest.fn().mockReturnValue('refresh-hash'),
    } as unknown as jest.Mocked<TokenService>;

    service = new AuthService(users, refreshTokens, passwords, tokens);
  });

  describe('register', () => {
    it('creates a user, persists a refresh token and returns tokens', async () => {
      users.findByEmail.mockResolvedValue(null);
      passwords.hash.mockResolvedValue('hashed');
      users.create.mockResolvedValue(buildUser());

      const result = await service.register({
        email: 'Alex@Example.com',
        password: 'S3curePass',
        displayName: 'Alex',
      });

      expect(users.create).toHaveBeenCalledWith({
        email: 'alex@example.com',
        displayName: 'Alex',
        passwordHash: 'hashed',
      });
      expect(refreshTokens.create).toHaveBeenCalled();
      expect(result.tokens.accessToken).toBe('access');
      expect(result.user.email).toBe('alex@example.com');
    });

    it('rejects a duplicate email', async () => {
      users.findByEmail.mockResolvedValue(buildUser());

      await expect(
        service.register({ email: 'alex@example.com', password: 'x', displayName: 'Alex' }),
      ).rejects.toBeInstanceOf(ConflictError);
      expect(users.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('rejects when the user does not exist', async () => {
      users.findByEmail.mockResolvedValue(null);
      await expect(
        service.login({ email: 'nobody@example.com', password: 'x' }),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('rejects on wrong password', async () => {
      users.findByEmail.mockResolvedValue(buildUser());
      passwords.verify.mockResolvedValue(false);
      await expect(
        service.login({ email: 'alex@example.com', password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('issues tokens on valid credentials', async () => {
      users.findByEmail.mockResolvedValue(buildUser());
      passwords.verify.mockResolvedValue(true);
      const result = await service.login({ email: 'alex@example.com', password: 'S3curePass' });
      expect(result.tokens.refreshToken).toBe('refresh');
    });
  });

  describe('refresh', () => {
    it('rejects a revoked token', async () => {
      refreshTokens.findByHash.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: 'refresh-hash',
        expiresAt: new Date(Date.now() + 10_000),
        revokedAt: new Date(),
        createdAt: new Date(),
      });
      await expect(service.refresh('refresh')).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('rotates a valid token', async () => {
      refreshTokens.findByHash.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: 'refresh-hash',
        expiresAt: new Date(Date.now() + 10_000),
        revokedAt: null,
        createdAt: new Date(),
      });
      users.findById.mockResolvedValue(buildUser());

      await service.refresh('refresh');

      expect(refreshTokens.revoke).toHaveBeenCalledWith('rt-1');
      expect(refreshTokens.create).toHaveBeenCalled();
    });
  });
});
