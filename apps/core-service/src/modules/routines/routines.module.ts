import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { RoutinesService } from './application/routines.service';
import { ROUTINE_REPOSITORY } from './domain/routine.repository';
import { PrismaRoutineRepository } from './infrastructure/prisma-routine.repository';
import { RoutinesController } from './infrastructure/routines.controller';

@Module({
  imports: [ActivityModule],
  controllers: [RoutinesController],
  providers: [RoutinesService, { provide: ROUTINE_REPOSITORY, useClass: PrismaRoutineRepository }],
})
export class RoutinesModule {}
