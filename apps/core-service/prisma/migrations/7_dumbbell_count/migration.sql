-- AlterTable: how many dumbbells were used (1 or 2), for dumbbell exercises.
ALTER TABLE "workout_exercises" ADD COLUMN "dumbbells" INTEGER;

-- Exercises already logged with dumbbells: two, the usual case.
UPDATE "workout_exercises" SET "dumbbells" = 2 WHERE "equipment" = 'dumbbell';
