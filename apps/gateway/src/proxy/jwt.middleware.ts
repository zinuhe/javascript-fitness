import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtAccessPayload, ProblemDetails } from '@fitness/contracts';

/**
 * Express middleware that verifies the Bearer access token at the edge and fails fast
 * (401 problem+json) before proxying. On success it forwards the identity to the upstream
 * service via `x-user-id` / `x-user-email` headers (services still re-verify the JWT).
 */
export function createJwtMiddleware(secret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return unauthorized(req, res, 'Missing bearer token');
    }

    const token = header.slice('Bearer '.length);
    try {
      const payload = jwt.verify(token, secret) as JwtAccessPayload;
      req.headers['x-user-id'] = payload.sub;
      req.headers['x-user-email'] = payload.email;
      next();
    } catch {
      unauthorized(req, res, 'Invalid or expired token');
    }
  };
}

function unauthorized(req: Request, res: Response, detail: string): void {
  const problem: ProblemDetails = {
    type: 'urn:fitness:error:auth.unauthorized',
    title: 'auth.unauthorized',
    status: 401,
    detail,
    instance: req.originalUrl,
    correlationId: req.headers['x-correlation-id'] as string | undefined,
  };
  res.status(401).type('application/problem+json').json(problem);
}
