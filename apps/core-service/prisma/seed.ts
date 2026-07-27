import { PrismaClient, type Prisma } from '../generated/prisma';

const prisma = new PrismaClient();

/** Starter catalog of common exercises. Idempotent thanks to skipDuplicates. */
const EXERCISES: Prisma.ExerciseCreateManyInput[] = [
  { name: 'Barbell Bench Press', muscleGroup: 'chest', equipment: 'barbell' },
  { name: 'Incline Dumbbell Press', muscleGroup: 'chest', equipment: 'dumbbell' },
  { name: 'Pull-up', muscleGroup: 'back', equipment: 'bodyweight' },
  { name: 'Barbell Deadlift', muscleGroup: 'back', equipment: 'barbell' },
  { name: 'Barbell Back Squat', muscleGroup: 'legs', equipment: 'barbell' },
  { name: 'Leg Press', muscleGroup: 'legs', equipment: 'machine' },
  { name: 'Overhead Press', muscleGroup: 'shoulders', equipment: 'barbell' },
  { name: 'Lateral Raise', muscleGroup: 'shoulders', equipment: 'dumbbell' },
  { name: 'Barbell Curl', muscleGroup: 'biceps', equipment: 'barbell' },
  { name: 'Triceps Pushdown', muscleGroup: 'triceps', equipment: 'cable' },
  { name: 'Plank', muscleGroup: 'core', equipment: 'bodyweight' },
];

async function main(): Promise<void> {
  const result = await prisma.exercise.createMany({
    data: EXERCISES,
    skipDuplicates: true,
  });
  console.log(`Seed complete: ${result.count} exercises inserted.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
