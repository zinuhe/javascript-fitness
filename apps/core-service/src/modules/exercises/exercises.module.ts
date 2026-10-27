import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { ExercisesService } from './application/exercises.service';
import { EXERCISE_REPOSITORY } from './domain/exercise.repository';
import { PrismaExerciseRepository } from './infrastructure/prisma-exercise.repository';
import { ExercisesController } from './infrastructure/exercises.controller';

@Module({
  imports: [ActivityModule],
  controllers: [ExercisesController],
  providers: [
    ExercisesService,
    { provide: EXERCISE_REPOSITORY, useClass: PrismaExerciseRepository },
  ],
  exports: [ExercisesService],
})
export class ExercisesModule {}
