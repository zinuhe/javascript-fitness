-- An exercise can be done with several pieces of equipment; each logged exercise records
-- which one was used. Existing data is converted in place, nothing is dropped.

-- AlterTable: logged exercises keep the equipment their exercise had.
ALTER TABLE "workout_exercises" ADD COLUMN "equipment" "Equipment";

UPDATE "workout_exercises" AS w
SET "equipment" = e."equipment"
FROM "exercises" AS e
WHERE w."exerciseId" = e."id";

-- DropIndex: the name no longer carries the equipment, so it is unique on its own.
DROP INDEX "exercises_name_equipment_key";

-- AlterTable: a single equipment becomes a one-item list.
ALTER TABLE "exercises"
  ALTER COLUMN "equipment" TYPE "Equipment"[] USING ARRAY["equipment"];

-- CreateIndex
CREATE UNIQUE INDEX "exercises_name_key" ON "exercises"("name");
