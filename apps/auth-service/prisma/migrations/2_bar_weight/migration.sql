-- AlterTable: the user's barbell, added to the plates typed for barbell exercises.
ALTER TABLE "users" ADD COLUMN "barWeightKg" DECIMAL(5,2) NOT NULL DEFAULT 12.5;
