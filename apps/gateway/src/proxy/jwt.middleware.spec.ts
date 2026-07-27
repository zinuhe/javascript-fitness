import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { createJwtMiddleware } from './jwt.middleware';

const SECRET = 'test_secret_that_is_at_least_32_characters_long';

function mockRes(): Response {
  const res = {} as Record<string, unknown>;
  res.status = jest.fn().mockReturnValue(res);
  res.type = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as unknown as Response;
}

describe('createJwtMiddleware', () => {
  const middleware = createJwtMiddleware(SECRET);

  it('rejects a request without a bearer token (401)', () => {
    const req = { headers: {}, originalUrl: '/api/workouts' } as unknown as Request;
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an invalid token (401)', () => {
    const req = {
      headers: { authorization: 'Bearer not-a-real-token' },
      originalUrl: '/api/workouts',
    } as unknown as Request;
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a valid token and forwards identity headers', () => {
    const token = jwt.sign({ sub: 'user-1', email: 'a@b.com' }, SECRET);
    const req = {
      headers: { authorization: `Bearer ${token}` },
      originalUrl: '/api/workouts',
    } as unknown as Request;
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.headers['x-user-id']).toBe('user-1');
    expect(req.headers['x-user-email']).toBe('a@b.com');
  });
});
