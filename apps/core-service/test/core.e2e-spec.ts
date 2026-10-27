import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import {
  Equipment,
  MuscleGroup,
  type Exercise,
  type LastExerciseSets,
  type NextRoutineDay,
  type Routine,
  type Workout,
} from '@fitness/contracts';
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
        equipment: [Equipment.Barbell],
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
        equipment: ['barbell'],
        description: 'Low bar',
      });

      const list = await as(token).get('/exercises?pageSize=100').expect(200);
      expect(list.body.items.map((e: Exercise) => e.id)).toContain(created.id);
    });

    it('rejects a duplicate name, whatever the equipment (409)', async () => {
      const token = tokenFor();
      const existing = await createExercise(token);

      const res = await as(token)
        .post('/exercises', {
          name: existing.name.toUpperCase(),
          muscleGroup: MuscleGroup.Legs,
          equipment: [Equipment.Dumbbell],
        })
        .expect(409);
      expect(res.body.title).toBe('exercise.duplicate');
    });

    it('needs at least one known equipment, without repeats (400); a disk is one', async () => {
      const token = tokenFor();
      const base = { name: `Row ${randomUUID()}`, muscleGroup: MuscleGroup.Back };
      await as(token)
        .post('/exercises', { ...base, equipment: [] })
        .expect(400);
      await as(token)
        .post('/exercises', { ...base, equipment: ['spoon'] })
        .expect(400);
      await as(token)
        .post('/exercises', { ...base, equipment: 'barbell' })
        .expect(400);
      await as(token)
        .post('/exercises', { ...base, equipment: [Equipment.Cable, Equipment.Cable] })
        .expect(400);
      const plate = await as(token)
        .post('/exercises', { ...base, equipment: [Equipment.Disk] })
        .expect(201);
      expect((plate.body as Exercise).equipment).toEqual(['disk']);
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

    describe('with several pieces of equipment', () => {
      const log = (token: string, performedAt: string, equipment: Equipment, weightKg: number) =>
        as(token).post('/workouts', {
          performedAt,
          exercises: [{ exerciseId: press.id, equipment, sets: [{ reps: 8, weightKg }] }],
        });
      let token: string;
      let press: Exercise;

      beforeEach(async () => {
        token = tokenFor();
        press = await createExercise(token, {
          muscleGroup: MuscleGroup.Chest,
          equipment: [Equipment.Barbell, Equipment.Dumbbell],
        });
      });

      it('records which one was used, and requires choosing it (422)', async () => {
        const res = await log(token, '2026-10-01T09:00:00.000Z', Equipment.Dumbbell, 30).expect(
          201,
        );
        expect((res.body as Workout).exercises[0].equipment).toBe('dumbbell');

        const missing = await as(token)
          .post('/workouts', {
            exercises: [{ exerciseId: press.id, sets: [{ reps: 8, weightKg: 60 }] }],
          })
          .expect(422);
        expect(missing.body.title).toBe('workout.invalid_equipment');
        await log(token, '2026-10-01T09:00:00.000Z', Equipment.Cable, 30).expect(422);
      });

      it('keeps the last sets and the progress apart per equipment', async () => {
        await log(token, '2026-10-01T09:00:00.000Z', Equipment.Barbell, 80).expect(201);
        await log(token, '2026-10-08T09:00:00.000Z', Equipment.Dumbbell, 30).expect(201);

        const last = await as(token).get(`/workouts/last-sets?exerciseIds=${press.id}`).expect(200);
        expect(
          (last.body as LastExerciseSets[]).map((e) => [e.equipment, e.sets[0].weightKg]),
        ).toEqual([
          ['dumbbell', 30],
          ['barbell', 80],
        ]);

        const barbell = await as(token)
          .get(`/workouts/progress/${press.id}?equipment=barbell`)
          .expect(200);
        expect(barbell.body.points).toEqual([
          expect.objectContaining({ performedAt: '2026-10-01T09:00:00.000Z', bestSetWeightKg: 80 }),
        ]);
        const all = await as(token).get(`/workouts/progress/${press.id}`).expect(200);
        expect(all.body.points).toHaveLength(2);
        await as(token).get(`/workouts/progress/${press.id}?equipment=spoon`).expect(400);
      });

      it('keeps the bar weight of barbell sets, also for the next pre-fill', async () => {
        const res = await as(token)
          .post('/workouts', {
            performedAt: '2026-10-01T09:00:00.000Z',
            exercises: [
              {
                exerciseId: press.id,
                equipment: Equipment.Barbell,
                barKg: 12.5,
                sets: [{ reps: 8, weightKg: 32.5 }], // 20 kg of plates + the bar
              },
            ],
          })
          .expect(201);
        expect((res.body as Workout).exercises[0]).toMatchObject({
          barKg: 12.5,
          sets: [expect.objectContaining({ weightKg: 32.5 })],
        });

        const last = await as(token).get(`/workouts/last-sets?exerciseIds=${press.id}`).expect(200);
        expect(last.body).toEqual([expect.objectContaining({ equipment: 'barbell', barKg: 12.5 })]);

        const dumbbell = await as(token)
          .post('/workouts', {
            exercises: [
              {
                exerciseId: press.id,
                equipment: Equipment.Dumbbell,
                barKg: 12.5,
                sets: [{ reps: 8, weightKg: 30 }],
              },
            ],
          })
          .expect(422);
        expect(dumbbell.body.title).toBe('workout.bar_without_barbell');
      });

      it('equipment used by logged workouts cannot be removed (409)', async () => {
        await log(token, '2026-10-01T09:00:00.000Z', Equipment.Dumbbell, 30).expect(201);

        const res = await request(http)
          .patch(`/exercises/${press.id}`)
          .set('authorization', `Bearer ${token}`)
          .send({ equipment: [Equipment.Barbell] })
          .expect(409);
        expect(res.body.title).toBe('exercise.equipment_in_use');

        const ok = await request(http)
          .patch(`/exercises/${press.id}`)
          .set('authorization', `Bearer ${token}`)
          .send({ equipment: [Equipment.Dumbbell, Equipment.Kettlebell] })
          .expect(200);
        expect((ok.body as Exercise).equipment).toEqual(['dumbbell', 'kettlebell']);
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
  describe('routines', () => {
    /** A 3-day split (Push / Pull / Legs), one exercise per day, for a fresh user. */
    async function threeDaySplit(token: string) {
      const [bench, row, squat] = await Promise.all([
        createExercise(token, { muscleGroup: MuscleGroup.Chest }),
        createExercise(token, { muscleGroup: MuscleGroup.Back }),
        createExercise(token),
      ]);
      const routine = (
        await as(token)
          .post('/routines', {
            name: 'Push / Pull / Legs',
            days: [
              { name: 'Push', exerciseIds: [bench.id] },
              { name: 'Pull', exerciseIds: [row.id] },
              { name: 'Legs', exerciseIds: [squat.id] },
            ],
          })
          .expect(201)
      ).body as Routine;
      return { routine, bench, row, squat };
    }

    const logDay = (token: string, dayId: string, exerciseId: string, performedAt: string) =>
      as(token)
        .post('/workouts', {
          performedAt,
          routineDayId: dayId,
          exercises: [{ exerciseId, sets: [{ reps: 5, weightKg: 100 }] }],
        })
        .expect(201);

    const nextDayName = async (token: string) =>
      ((await as(token).get('/routines/next').expect(200)).body as NextRoutineDay).day.name;

    it('creates a routine with ordered days; the first one is active', async () => {
      const token = tokenFor();
      const { routine, bench, row, squat } = await threeDaySplit(token);

      expect(routine.isActive).toBe(true);
      expect(routine.days.map((d) => [d.position, d.name, d.exerciseIds])).toEqual([
        [0, 'Push', [bench.id]],
        [1, 'Pull', [row.id]],
        [2, 'Legs', [squat.id]],
      ]);
      const list = await as(token).get('/routines').expect(200);
      expect(list.body.map((r: Routine) => r.id)).toEqual([routine.id]);
    });

    it('rotates through the days and wraps back to day one', async () => {
      const token = tokenFor();
      const { routine, bench, row, squat } = await threeDaySplit(token);
      const [push, pull, legs] = routine.days;

      expect(await nextDayName(token)).toBe('Push'); // nothing logged yet
      await logDay(token, push.id, bench.id, '2026-10-01T09:00:00.000Z');
      expect(await nextDayName(token)).toBe('Pull');
      await logDay(token, pull.id, row.id, '2026-10-03T09:00:00.000Z');
      expect(await nextDayName(token)).toBe('Legs');
      await logDay(token, legs.id, squat.id, '2026-10-05T09:00:00.000Z');
      expect(await nextDayName(token)).toBe('Push'); // wrap-around

      // Workouts carry a label for their routine day.
      const list = await as(token).get('/workouts').expect(200);
      expect((list.body.items as Workout[])[0].routineDay).toMatchObject({
        id: legs.id,
        routineId: routine.id,
        routineName: 'Push / Pull / Legs',
        name: 'Legs',
        position: 2,
      });
    });

    it('history logged later with older dates does not move the rotation', async () => {
      const token = tokenFor();
      const { routine, bench, row, squat } = await threeDaySplit(token);
      const [push, pull, legs] = routine.days;
      await logDay(token, push.id, bench.id, '2026-10-20T09:00:00.000Z');

      // Old sessions typed in afterwards: the newest date still decides.
      await logDay(token, legs.id, squat.id, '2026-09-05T09:00:00.000Z');
      await logDay(token, pull.id, row.id, '2026-09-03T09:00:00.000Z');
      expect(await nextDayName(token)).toBe('Pull');
    });

    it('PUT changes the routine day of a workout, null unlinks it, omitted keeps it', async () => {
      const token = tokenFor();
      const { routine, bench } = await threeDaySplit(token);
      const [push, , legs] = routine.days;
      const workout = (await logDay(token, push.id, bench.id, '2026-10-01T09:00:00.000Z'))
        .body as Workout;
      const body = { exercises: [{ exerciseId: bench.id, sets: [{ reps: 5, weightKg: 100 }] }] };

      const moved = await as(token)
        .put(`/workouts/${workout.id}`, { ...body, routineDayId: legs.id })
        .expect(200);
      expect((moved.body as Workout).routineDay?.id).toBe(legs.id);
      expect(await nextDayName(token)).toBe('Push'); // after Legs, wraps around

      const kept = await as(token).put(`/workouts/${workout.id}`, body).expect(200);
      expect((kept.body as Workout).routineDay?.id).toBe(legs.id);

      const unlinked = await as(token)
        .put(`/workouts/${workout.id}`, { ...body, routineDayId: null })
        .expect(200);
      expect((unlinked.body as Workout).routineDay).toBeUndefined();
    });

    it('editing days keeps their ids, so the rotation keeps its place', async () => {
      const token = tokenFor();
      const { routine, bench, row, squat } = await threeDaySplit(token);
      const [push, pull, legs] = routine.days;
      await logDay(token, push.id, bench.id, '2026-10-01T09:00:00.000Z');

      // Rename Pull, swap its exercise, drop Legs and add Arms.
      const res = await as(token)
        .put(`/routines/${routine.id}`, {
          name: 'Upper / Lower',
          days: [
            { id: push.id, name: 'Push', exerciseIds: [bench.id] },
            { id: pull.id, name: 'Back', exerciseIds: [row.id, squat.id] },
            { name: 'Arms', exerciseIds: [bench.id] },
          ],
        })
        .expect(200);

      const updated = res.body as Routine;
      expect(updated.days.map((d) => [d.id === push.id, d.id === pull.id, d.name])).toEqual([
        [true, false, 'Push'],
        [false, true, 'Back'],
        [false, false, 'Arms'],
      ]);
      expect(updated.days.some((d) => d.id === legs.id)).toBe(false);
      expect(await nextDayName(token)).toBe('Back');

      await as(token)
        .put(`/routines/${routine.id}`, {
          name: 'x',
          days: [{ id: randomUUID(), exerciseIds: [bench.id] }],
        })
        .expect(422);
    });

    it('only one routine is active; next follows the active one', async () => {
      const token = tokenFor();
      const { routine: first } = await threeDaySplit(token);
      const exercise = await createExercise(token);
      const second = (
        await as(token)
          .post('/routines', {
            name: 'Full body',
            days: [{ name: 'FB', exerciseIds: [exercise.id] }],
          })
          .expect(201)
      ).body as Routine;
      expect(second.isActive).toBe(false);

      await as(token).post(`/routines/${second.id}/activate`, {}).expect(200);

      const list = (await as(token).get('/routines').expect(200)).body as Routine[];
      expect(list.map((r) => [r.id, r.isActive])).toEqual([
        [second.id, true],
        [first.id, false],
      ]);
      expect(await nextDayName(token)).toBe('FB');
    });

    it('next is 204 without an active routine; deleting a routine keeps its workouts', async () => {
      const token = tokenFor();
      await as(token).get('/routines/next').expect(204);

      const { routine, bench } = await threeDaySplit(token);
      const workout = (
        await logDay(token, routine.days[0].id, bench.id, '2026-10-01T09:00:00.000Z')
      ).body as Workout;

      await as(token).delete(`/routines/${routine.id}`).expect(204);

      const reread = (await as(token).get(`/workouts/${workout.id}`).expect(200)).body as Workout;
      expect(reread.routineDay).toBeUndefined();
      await as(token).get('/routines/next').expect(204);
    });

    it('keeps routines private and validates references', async () => {
      const owner = tokenFor();
      const intruder = tokenFor();
      const { routine, bench } = await threeDaySplit(owner);

      await as(intruder).get(`/routines/${routine.id}`).expect(404);
      await as(intruder).post(`/routines/${routine.id}/activate`, {}).expect(404);
      await as(intruder).delete(`/routines/${routine.id}`).expect(404);
      const borrowed = await as(intruder)
        .post('/workouts', {
          routineDayId: routine.days[0].id,
          exercises: [{ exerciseId: bench.id, sets: [{ reps: 1, weightKg: 1 }] }],
        })
        .expect(422);
      expect(borrowed.body.title).toBe('workout.unknown_routine_day');

      await as(owner).post('/routines', { name: 'Empty', days: [] }).expect(400);
      await as(owner)
        .post('/routines', { name: 'Ghost', days: [{ exerciseIds: [randomUUID()] }] })
        .expect(422);
    });

    it('an exercise used by a routine cannot be deleted', async () => {
      const token = tokenFor();
      const { bench } = await threeDaySplit(token);

      const res = await as(token).delete(`/exercises/${bench.id}`).expect(409);
      expect(res.body.title).toBe('exercise.in_use');
    });

    it('returns the last sets of each exercise for pre-filling a day', async () => {
      const token = tokenFor();
      const { bench, squat } = await threeDaySplit(token);
      const never = await createExercise(token);
      for (const [performedAt, weightKg] of [
        ['2026-10-01T09:00:00.000Z', 60],
        ['2026-10-08T09:00:00.000Z', 65],
      ] as const) {
        await as(token)
          .post('/workouts', {
            performedAt,
            exercises: [
              {
                exerciseId: bench.id,
                sets: [
                  { reps: 8, weightKg },
                  { reps: 6, weightKg: weightKg + 5, rpe: 9 },
                ],
              },
            ],
          })
          .expect(201);
      }
      await as(tokenFor())
        .post('/workouts', {
          exercises: [{ exerciseId: squat.id, sets: [{ reps: 1, weightKg: 300 }] }],
        })
        .expect(201); // another user's squat must not leak

      const res = await as(token)
        .get(`/workouts/last-sets?exerciseIds=${bench.id},${squat.id},${never.id}`)
        .expect(200);

      expect(res.body as LastExerciseSets[]).toEqual([
        {
          exerciseId: bench.id,
          equipment: 'barbell',
          performedAt: '2026-10-08T09:00:00.000Z',
          sets: [
            { reps: 8, weightKg: 65 },
            { reps: 6, weightKg: 70, rpe: 9 },
          ],
        },
      ]);
      await as(token).get('/workouts/last-sets?exerciseIds=not-a-uuid').expect(400);
    });
  });
});
