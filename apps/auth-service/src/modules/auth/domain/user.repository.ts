import type { UserEntity } from './user.entity';

export interface CreateUserData {
  email: string;
  displayName: string;
  passwordHash: string;
}

/**
 * Port for user persistence. The application layer depends only on this interface; the
 * Prisma adapter lives in `infrastructure`. Swap datastores by binding another adapter.
 */
export interface UserRepository {
  create(data: CreateUserData): Promise<UserEntity>;
  findById(id: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
}

/** DI token — interfaces don't exist at runtime, so we bind by symbol. */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
