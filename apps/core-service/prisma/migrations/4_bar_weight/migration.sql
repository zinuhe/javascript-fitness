-- AlterTable: barbell weight included in each set's weightKg (sets store the total lifted).
ALTER TABLE "workout_exercises" ADD COLUMN "barKg" DECIMAL(5,2);
