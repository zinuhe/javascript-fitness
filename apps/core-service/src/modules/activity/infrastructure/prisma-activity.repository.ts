import { Injectable } from '@nestjs/common';
import type { ActivityEntry } from '@fitness/contracts';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ActivityRepository, RecordActivityData } from '../domain/activity.repository';

/** Prisma adapter for {@link ActivityRepository}. */
@Injectable()
export class PrismaActivityRepository implements ActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(data: RecordActivityData): Promise<void> {
    await this.prisma.activityEntry.create({ data });
  }

  async findRecentForUser(userId: string, limit: number): Promise<ActivityEntry[]> {
    const rows = await this.prisma.activityEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      summary: row.summary,
      subjectAt: row.subjectAt?.toISOString(),
      device: row.device,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
