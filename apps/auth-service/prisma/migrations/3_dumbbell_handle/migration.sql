-- AlterTable: the user's heavy (adjustable) dumbbell handle, added to the plates they type for
-- heavy dumbbell exercises (per dumbbell). 5.44 kg is 12 lb.
ALTER TABLE "users" ADD COLUMN "dumbbellHandleKg" DECIMAL(5,2) NOT NULL DEFAULT 5.44;
