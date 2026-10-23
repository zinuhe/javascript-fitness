-- AlterTable
ALTER TABLE "workouts" ADD COLUMN     "routineDayId" UUID;

-- CreateTable
CREATE TABLE "routines" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_days" (
    "id" UUID NOT NULL,
    "routineId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT,

    CONSTRAINT "routine_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_day_exercises" (
    "id" UUID NOT NULL,
    "dayId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "routine_day_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "routines_userId_idx" ON "routines"("userId");

-- CreateIndex
CREATE INDEX "routine_days_routineId_idx" ON "routine_days"("routineId");

-- CreateIndex
CREATE INDEX "routine_day_exercises_dayId_idx" ON "routine_day_exercises"("dayId");

-- CreateIndex
CREATE INDEX "routine_day_exercises_exerciseId_idx" ON "routine_day_exercises"("exerciseId");

-- CreateIndex
CREATE INDEX "workouts_routineDayId_idx" ON "workouts"("routineDayId");

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_routineDayId_fkey" FOREIGN KEY ("routineDayId") REFERENCES "routine_days"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_days" ADD CONSTRAINT "routine_days_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_day_exercises" ADD CONSTRAINT "routine_day_exercises_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "routine_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_day_exercises" ADD CONSTRAINT "routine_day_exercises_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

