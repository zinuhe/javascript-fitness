import type { WeightUnit } from '@fitness/contracts';

/** Domain entity — plain, persistence-agnostic representation of a user. */
export interface UserEntity {
  id: string;
  email: string;
  displayName: string;
  weightUnit: WeightUnit;
  passwordHash: string;
  createdAt: Date;
}

export interface RefreshTokenEntity {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}
