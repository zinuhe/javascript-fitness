import { Module } from '@nestjs/common';
import { ActivityService } from './application/activity.service';
import { ACTIVITY_REPOSITORY } from './domain/activity.repository';
import { ActivityController } from './infrastructure/activity.controller';
import { PrismaActivityRepository } from './infrastructure/prisma-activity.repository';

/** The user's activity log; other modules record into it through {@link ActivityService}. */
@Module({
  controllers: [ActivityController],
  providers: [
    ActivityService,
    { provide: ACTIVITY_REPOSITORY, useClass: PrismaActivityRepository },
  ],
  exports: [ActivityService],
})
export class ActivityModule {}
