import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { ExercisesService } from './application/exercises.service';
import { ExerciseImagesService } from './application/exercise-images.service';
import { EXERCISE_REPOSITORY } from './domain/exercise.repository';
import { EXERCISE_IMAGE_REPOSITORY } from './domain/exercise-image.repository';
import { PrismaExerciseRepository } from './infrastructure/prisma-exercise.repository';
import { PrismaExerciseImageRepository } from './infrastructure/prisma-exercise-image.repository';
import { ExercisesController } from './infrastructure/exercises.controller';
import { ExerciseMediaController } from './infrastructure/exercise-media.controller';

@Module({
  imports: [ActivityModule],
  controllers: [ExercisesController, ExerciseMediaController],
  providers: [
    ExercisesService,
    ExerciseImagesService,
    { provide: EXERCISE_REPOSITORY, useClass: PrismaExerciseRepository },
    { provide: EXERCISE_IMAGE_REPOSITORY, useClass: PrismaExerciseImageRepository },
  ],
  exports: [ExercisesService],
})
export class ExercisesModule {}
