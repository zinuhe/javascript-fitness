import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { UpdateProfileRequest, WeightUnit } from '@fitness/contracts';
import type { UserEntity } from '../domain/user.entity';
import type { CreateUserData, UserRepository } from '../domain/user.repository';

type UserWithCredential = {
  id: string;
  email: string;
  displayName: string;
  weightUnit: WeightUnit;
  createdAt: Date;
  credential: { passwordHash: string } | null;
};

/** Prisma-backed adapter for {@link UserRepository}. The only place Prisma is used. */
@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateUserData): Promise<UserEntity> {
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        displayName: data.displayName,
        credential: { create: { passwordHash: data.passwordHash } },
      },
      include: { credential: true },
    });
    return this.toEntity(user);
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { credential: true },
    });
    return user ? this.toEntity(user) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { credential: true },
    });
    return user ? this.toEntity(user) : null;
  }

  async updateProfile(id: string, data: UpdateProfileRequest): Promise<UserEntity | null> {
    // updateMany: no exception for a missing id, then read back with the credential.
    const { count } = await this.prisma.user.updateMany({ where: { id }, data });
    return count > 0 ? this.findById(id) : null;
  }

  private toEntity(user: UserWithCredential): UserEntity {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      weightUnit: user.weightUnit,
      passwordHash: user.credential?.passwordHash ?? '',
      createdAt: user.createdAt,
    };
  }
}
