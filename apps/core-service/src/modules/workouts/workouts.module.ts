import { Module } from '@nestjs/common';
import { WorkoutsService } from './application/workouts.service';
import { WORKOUT_REPOSITORY } from './domain/workout.repository';
import { PrismaWorkoutRepository } from './infrastructure/prisma-workout.repository';
import { WorkoutsController } from './infrastructure/workouts.controller';

@Module({
  controllers: [WorkoutsController],
  providers: [WorkoutsService, { provide: WORKOUT_REPOSITORY, useClass: PrismaWorkoutRepository }],
})
export class WorkoutsModule {}
