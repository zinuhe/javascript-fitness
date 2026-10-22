import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { Equipment, MuscleGroup, type Exercise, type Workout } from '@fitness/contracts';
import { createApp } from './app';

/** Access token as auth-service would issue it (same shared secret, payload and expiry). */
function tokenFor(userId = randomUUID()): string {
  return jwt.sign({ sub: userId, email: `${userId}@example.com` }, process.env.JWT_ACCESS_SECRET!, {
    expiresIn: 900,
  });
}

describe('core-service (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    app = await createApp();
    http = app.getHttpServer();
  });

  afterAll(() => app.close());

  const as = (token: string) => ({
    get: (url: string) => request(http).get(url).set('authorization', `Bearer ${token}`),
    post: (url: string, body: object) =>
      request(http).post(url).set('authorization', `Bearer ${token}`).send(body),
    put: (url: string, body: object) =>
      request(http).put(url).set('authorization', `Bearer ${token}`).send(body),
    delete: (url: string) => request(http).delete(url).set('authorization', `Bearer ${token}`),
  });

  /** Creates a catalog exercise with a unique name (the database is shared by the suite). */
  async function createExercise(token: string, over: Partial<Exercise> = {}): Promise<Exercise> {
    const res = await as(token)
      .post('/exercises', {
        name: `Squat ${randomUUID()}`,
        muscleGroup: MuscleGroup.Legs,
        equipment: Equipment.Barbell,
        ...over,
      })
      .expect(201);
    return res.body as Exercise;
  }

  it('requires an access token signed with the shared secret', async () => {
    await request(http).get('/exercises').expect(401);
    const forged = jwt.sign(
      { sub: randomUUID(), email: 'x@example.com' },
      'another-secret-32-chars-long-xxxxx',
    );
    await as(forged).get('/exercises').expect(401);
  });

  describe('exercises', () => {
    it('creates, reads and lists catalog exercises', async () => {
      const token = tokenFor();
      const created = await createExercise(token, { description: 'Low bar' });

      const read = await as(token).get(`/exercises/${created.id}`).expect(200);
      expect(read.body).toMatchObject({
        id: created.id,
        muscleGroup: 'legs',
        equipment: 'barbell',
        description: 'Low bar',
      });

      const list = await as(token).get('/exercises?pageSize=100').expect(200);
      expect(list.body.items.map((e: Exercise) => e.id)).toContain(created.id);
    });

    it('rejects a duplicate name + equipment (409)', async () => {
      const token = tokenFor();
      const existing = await createExercise(token);

      const res = await as(token)
        .post('/exercises', {
          name: existing.name,
          muscleGroup: MuscleGroup.Legs,
          equipment: Equipment.Barbell,
        })
        .expect(409);
      expect(res.body.title).toBe('exercise.duplicate');
    });

    it('validates query params and ids (400)', async () => {
      const token = tokenFor();
      await as(token).get('/exercises?pageSize=101').expect(400);
      await as(token).get('/exercises/not-a-uuid').expect(400);
    });
  });

  describe('workouts', () => {
    it('logs a workout keeping exercise and set order and decimal values', async () => {
      const token = tokenFor();
      const squat = await createExercise(token);
      const bench = await createExercise(token, { muscleGroup: MuscleGroup.Chest });

      const res = await as(token)
        .post('/workouts', {
          performedAt: '2026-10-18T09:00:00.000Z',
          notes: 'Leg day',
          exercises: [
            {
              exerciseId: squat.id,
              sets: [
                { reps: 5, weightKg: 100, rpe: 8.5, restSeconds: 180 },
                { reps: 5, weightKg: 102.5 },
              ],
            },
            { exerciseId: bench.id, sets: [{ reps: 8, weightKg: 60 }] },
          ],
        })
        .expect(201);

      const workout = res.body as Workout;
      expect(workout.performedAt).toBe('2026-10-18T09:00:00.000Z');
      expect(workout.exercises.map((e) => e.exerciseId)).toEqual([squat.id, bench.id]);
      expect(workout.exercises[0].sets).toEqual([
        expect.objectContaining({ order: 0, reps: 5, weightKg: 100, rpe: 8.5, restSeconds: 180 }),
        expect.objectContaining({ order: 1, reps: 5, weightKg: 102.5 }),
      ]);
    });

    it('rejects unknown exercises (422) and out-of-range values (400)', async () => {
      const token = tokenFor();
      const squat = await createExercise(token);
      const ghost = randomUUID();

      const unknown = await as(token)
        .post('/workouts', { exercises: [{ exerciseId: ghost, sets: [{ reps: 5, weightKg: 1 }] }] })
        .expect(422);
      expect(unknown.body).toMatchObject({
        title: 'workout.unknown_exercise',
        errors: { exerciseId: [ghost] },
      });

      await as(token)
        .post('/workouts', {
          exercises: [{ exerciseId: squat.id, sets: [{ reps: 5, weightKg: 10000 }] }],
        })
        .expect(400);
    });

    it('keeps each user’s workouts private', async () => {
      const owner = tokenFor();
      const intruder = tokenFor();
      const squat = await createExercise(owner);
      const workout = (
        await as(owner)
          .post('/workouts', {
            exercises: [{ exerciseId: squat.id, sets: [{ reps: 5, weightKg: 100 }] }],
          })
          .expect(201)
      ).body as Workout;

      await as(intruder).get(`/workouts/${workout.id}`).expect(404);
      const list = await as(intruder).get('/workouts').expect(200);
      expect(list.body.total).toBe(0);
      await as(intruder)
        .put(`/workouts/${workout.id}`, {
          exercises: [{ exerciseId: squat.id, sets: [{ reps: 1, weightKg: 1 }] }],
        })
        .expect(404);
      await as(intruder).delete(`/workouts/${workout.id}`).expect(404);

      await as(owner).get(`/workouts/${workout.id}`).expect(200);
    });

    it('replaces a workout with PUT, keeping its id, date and untouched set fields', async () => {
      const token = tokenFor();
      const squat = await createExercise(token);
      const bench = await createExercise(token, { muscleGroup: MuscleGroup.Chest });
      const original = (
        await as(token)
          .post('/workouts', {
            performedAt: '2026-10-18T09:00:00.000Z',
            notes: 'Original',
            exercises: [{ exerciseId: squat.id, sets: [{ reps: 5, weightKg: 100, rpe: 8 }] }],
          })
          .expect(201)
      ).body as Workout;

      const res = await as(token)
        .put(`/workouts/${original.id}`, {
          exercises: [
            { exerciseId: bench.id, sets: [{ reps: 8, weightKg: 60 }] },
            { exerciseId: squat.id, sets: [{ reps: 3, weightKg: 110, rpe: 9 }] },
          ],
        })
        .expect(200);

      const updated = res.body as Workout;
      expect(updated).toMatchObject({
        id: original.id,
        createdAt: original.createdAt,
        performedAt: '2026-10-18T09:00:00.000Z', // omitted → kept
      });
      expect(updated.notes).toBeUndefined(); // omitted → cleared
      expect(
        updated.exercises.map((e) => [
          e.exerciseId,
          e.sets.map((s) => [s.reps, s.weightKg, s.rpe]),
        ]),
      ).toEqual([
        [bench.id, [[8, 60, undefined]]],
        [squat.id, [[3, 110, 9]]],
      ]);

      const reread = await as(token).get(`/workouts/${original.id}`).expect(200);
      expect(reread.body).toEqual(updated);
    });

    it('leaves the workout untouched when a PUT is rejected', async () => {
      const token = tokenFor();
      const squat = await createExercise(token);
      const original = (
        await as(token)
          .post('/workouts', {
            exercises: [{ exerciseId: squat.id, sets: [{ reps: 5, weightKg: 100 }] }],
          })
          .expect(201)
      ).body as Workout;

      await as(token)
        .put(`/workouts/${original.id}`, {
          exercises: [{ exerciseId: randomUUID(), sets: [{ reps: 1, weightKg: 1 }] }],
        })
        .expect(422);

      const reread = await as(token).get(`/workouts/${original.id}`).expect(200);
      expect(reread.body).toEqual(original);
    });

    it('computes progress per session from the logged sets', async () => {
      const token = tokenFor();
      const squat = await createExercise(token);
      for (const [performedAt, weightKg] of [
        ['2026-10-01T09:00:00.000Z', 100],
        ['2026-10-08T09:00:00.000Z', 110],
      ] as const) {
        await as(token)
          .post('/workouts', {
            performedAt,
            exercises: [
              {
                exerciseId: squat.id,
                sets: [
                  { reps: 5, weightKg },
                  { reps: 3, weightKg },
                ],
              },
            ],
          })
          .expect(201);
      }

      const res = await as(token).get(`/workouts/progress/${squat.id}`).expect(200);

      expect(res.body).toEqual({
        exerciseId: squat.id,
        points: [
          {
            performedAt: '2026-10-01T09:00:00.000Z',
            totalVolumeKg: 800,
            estimatedOneRepMaxKg: 116.67,
            bestSetWeightKg: 100,
          },
          {
            performedAt: '2026-10-08T09:00:00.000Z',
            totalVolumeKg: 880,
            estimatedOneRepMaxKg: 128.33,
            bestSetWeightKg: 110,
          },
        ],
      });
    });

    it('blocks deleting an exercise that workouts use, until those workouts are gone', async () => {
      const token = tokenFor();
      const squat = await createExercise(token);
      const workout = (
        await as(token)
          .post('/workouts', {
            exercises: [{ exerciseId: squat.id, sets: [{ reps: 5, weightKg: 100 }] }],
          })
          .expect(201)
      ).body as Workout;

      const blocked = await as(token).delete(`/exercises/${squat.id}`).expect(409);
      expect(blocked.body.title).toBe('exercise.in_use');

      await as(token).delete(`/workouts/${workout.id}`).expect(204);
      await as(token).get(`/workouts/${workout.id}`).expect(404);
      await as(token).delete(`/exercises/${squat.id}`).expect(204);
    });
  });
});
