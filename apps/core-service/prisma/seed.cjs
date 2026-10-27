// Starter catalog seed. Plain CommonJS so it runs with a bare `node` against the
// generated (CommonJS) Prisma client, no TS runner or experimental flags required.
const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

const EXERCISES = [
  { name: 'Barbell Bench Press', muscleGroup: 'chest', equipment: ['barbell'] },
  { name: 'Incline Dumbbell Press', muscleGroup: 'chest', equipment: ['dumbbell'] },
  { name: 'Pull-up', muscleGroup: 'back', equipment: ['bodyweight'] },
  { name: 'Barbell Deadlift', muscleGroup: 'back', equipment: ['barbell'] },
  { name: 'Barbell Back Squat', muscleGroup: 'legs', equipment: ['barbell'] },
  { name: 'Leg Press', muscleGroup: 'legs', equipment: ['machine'] },
  { name: 'Overhead Press', muscleGroup: 'shoulders', equipment: ['barbell'] },
  { name: 'Lateral Raise', muscleGroup: 'shoulders', equipment: ['dumbbell'] },
  { name: 'Barbell Curl', muscleGroup: 'biceps', equipment: ['barbell'] },
  { name: 'Triceps Pushdown', muscleGroup: 'triceps', equipment: ['cable'] },
  { name: 'Plank', muscleGroup: 'core', equipment: ['bodyweight'] },
];

async function main() {
  const result = await prisma.exercise.createMany({ data: EXERCISES, skipDuplicates: true });
  console.log(`Seed complete: ${result.count} exercises inserted.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
