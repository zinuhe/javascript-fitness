-- CreateEnum: muscles an exercise works, fine-grained enough for the muscle map.
CREATE TYPE "Muscle" AS ENUM ('chest', 'front_delts', 'side_delts', 'rear_delts', 'biceps', 'triceps', 'forearms', 'abs', 'obliques', 'traps', 'lats', 'upper_back', 'lower_back', 'glutes', 'quads', 'hamstrings', 'adductors', 'abductors', 'calves');

-- AlterTable
ALTER TABLE "exercises" ADD COLUMN "primaryMuscles" "Muscle"[] DEFAULT ARRAY[]::"Muscle"[],
ADD COLUMN "secondaryMuscles" "Muscle"[] DEFAULT ARRAY[]::"Muscle"[];

-- Existing exercises start from their muscle group, so none has an empty map.
UPDATE "exercises" SET "primaryMuscles" = CASE "muscleGroup"
  WHEN 'chest' THEN ARRAY['chest']::"Muscle"[]
  WHEN 'back' THEN ARRAY['lats', 'upper_back']::"Muscle"[]
  WHEN 'shoulders' THEN ARRAY['front_delts', 'side_delts']::"Muscle"[]
  WHEN 'biceps' THEN ARRAY['biceps']::"Muscle"[]
  WHEN 'triceps' THEN ARRAY['triceps']::"Muscle"[]
  WHEN 'legs' THEN ARRAY['quads', 'hamstrings']::"Muscle"[]
  WHEN 'glutes' THEN ARRAY['glutes']::"Muscle"[]
  WHEN 'core' THEN ARRAY['abs', 'obliques']::"Muscle"[]
  ELSE ARRAY[]::"Muscle"[]
END;
