-- AlterTable
ALTER TABLE "exercises" ADD COLUMN     "dose" TEXT,
ADD COLUMN     "warmup" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "routine_day_warmups" (
    "id" UUID NOT NULL,
    "dayId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "routine_day_warmups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "routine_day_warmups_dayId_idx" ON "routine_day_warmups"("dayId");

-- CreateIndex
CREATE INDEX "routine_day_warmups_exerciseId_idx" ON "routine_day_warmups"("exerciseId");

-- AddForeignKey
ALTER TABLE "routine_day_warmups" ADD CONSTRAINT "routine_day_warmups_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "routine_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_day_warmups" ADD CONSTRAINT "routine_day_warmups_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

