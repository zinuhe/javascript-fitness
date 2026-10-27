import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { AuthResponse } from '@fitness/contracts';
import { createApp } from './app';

const PASSWORD = 'S3curePassw0rd';
const uniqueEmail = () => `user-${randomUUID()}@example.com`;

describe('auth-service (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    app = await createApp();
    http = app.getHttpServer();
  });

  afterAll(() => app.close());

  const register = (email = uniqueEmail(), password = PASSWORD) =>
    request(http).post('/auth/register').send({ email, password, displayName: 'Alex' });

  describe('register', () => {
    it('creates the user with a normalised email and returns a token pair', async () => {
      const email = uniqueEmail();

      const res = await register(email.toUpperCase()).expect(201);

      const body = res.body as AuthResponse;
      expect(body.user).toMatchObject({ email, displayName: 'Alex' });
      expect(body.tokens).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
      expect(body.tokens.accessToken).toEqual(expect.any(String));
      expect(body.tokens.refreshToken).toEqual(expect.any(String));
    });

    it('rejects an email that is already registered (409 problem+json)', async () => {
      const email = uniqueEmail();
      await register(email).expect(201);

      const res = await register(email)
        .expect(409)
        .expect('content-type', /application\/problem\+json/);

      expect(res.body).toMatchObject({ status: 409, title: 'user.email_taken' });
      expect(res.body.correlationId).toEqual(expect.any(String));
    });

    it('validates the payload (400) and rejects unknown fields', async () => {
      const res = await request(http)
        .post('/auth/register')
        .send({ email: 'not-an-email', password: 'short', displayName: 'Alex', admin: true })
        .expect(400);

      const messages = (res.body.errors._ as string[]).join(' | ');
      expect(messages).toMatch(/email must be an email/);
      expect(messages).toMatch(/password must be longer than or equal to 8 characters/);
      expect(messages).toMatch(/property admin should not exist/);
    });
  });

  describe('login and profile', () => {
    it('signs in with the right password and returns the profile for the token', async () => {
      const email = uniqueEmail();
      await register(email).expect(201);

      const login = await request(http)
        .post('/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);
      const { tokens } = login.body as AuthResponse;

      const me = await request(http)
        .get('/auth/me')
        .set('authorization', `Bearer ${tokens.accessToken}`)
        .expect(200);
      expect(me.body).toMatchObject({ email, displayName: 'Alex' });
    });

    it('rejects a wrong password and an unknown email with the same 401', async () => {
      const email = uniqueEmail();
      await register(email).expect(201);

      const wrong = await request(http)
        .post('/auth/login')
        .send({ email, password: 'wrong-password' })
        .expect(401);
      const unknown = await request(http)
        .post('/auth/login')
        .send({ email: uniqueEmail(), password: PASSWORD })
        .expect(401);

      expect(wrong.body.title).toBe('auth.invalid_credentials');
      expect(unknown.body.title).toBe('auth.invalid_credentials');
    });

    it('requires a valid access token for the profile', async () => {
      await request(http).get('/auth/me').expect(401);
      await request(http).get('/auth/me').set('authorization', 'Bearer not-a-jwt').expect(401);
    });
  });

  describe('refresh tokens', () => {
    it('rotates: a refresh token works once and the new one keeps working', async () => {
      const { tokens } = (await register().expect(201)).body as AuthResponse;

      const first = await request(http)
        .post('/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(200);
      const rotated = (first.body as AuthResponse).tokens;
      expect(rotated.refreshToken).not.toBe(tokens.refreshToken);

      const reused = await request(http)
        .post('/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);
      expect(reused.body.title).toBe('auth.invalid_refresh_token');

      await request(http)
        .post('/auth/refresh')
        .send({ refreshToken: rotated.refreshToken })
        .expect(200);
    });

    it('logout revokes the refresh token', async () => {
      const { tokens } = (await register().expect(201)).body as AuthResponse;

      await request(http)
        .post('/auth/logout')
        .send({ refreshToken: tokens.refreshToken })
        .expect(204);

      await request(http)
        .post('/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);
    });
  });

  describe('profile', () => {
    it('defaults to kg and switches the weight unit with PATCH /auth/me', async () => {
      const { tokens, user } = (await register().expect(201)).body as AuthResponse;
      expect(user.weightUnit).toBe('kg');
      const auth = `Bearer ${tokens.accessToken}`;

      const patched = await request(http)
        .patch('/auth/me')
        .set('authorization', auth)
        .send({ weightUnit: 'lb' })
        .expect(200);
      expect(patched.body).toMatchObject({ weightUnit: 'lb', displayName: 'Alex' });

      const me = await request(http).get('/auth/me').set('authorization', auth).expect(200);
      expect(me.body.weightUnit).toBe('lb');
    });

    it('keeps the barbell weight, 12.5 kg by default, and validates it', async () => {
      const { tokens, user } = (await register().expect(201)).body as AuthResponse;
      expect(user.barWeightKg).toBe(12.5);
      const auth = `Bearer ${tokens.accessToken}`;

      const patched = await request(http)
        .patch('/auth/me')
        .set('authorization', auth)
        .send({ barWeightKg: 20 })
        .expect(200);
      expect(patched.body.barWeightKg).toBe(20);
      await request(http)
        .patch('/auth/me')
        .set('authorization', auth)
        .send({ barWeightKg: -1 })
        .expect(400);
      await request(http)
        .patch('/auth/me')
        .set('authorization', auth)
        .send({ barWeightKg: 101 })
        .expect(400);
    });

    it('validates the unit and requires a token', async () => {
      const { tokens } = (await register().expect(201)).body as AuthResponse;

      await request(http)
        .patch('/auth/me')
        .set('authorization', `Bearer ${tokens.accessToken}`)
        .send({ weightUnit: 'stone' })
        .expect(400);
      await request(http).patch('/auth/me').send({ weightUnit: 'lb' }).expect(401);
    });
  });

  it('reports the database as ready', async () => {
    const res = await request(http).get('/ready').expect(200);
    expect(res.body.info.database.status).toBe('up');
  });
});
