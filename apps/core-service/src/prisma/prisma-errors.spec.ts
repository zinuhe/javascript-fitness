import type { ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from '@fitness/common';
import { Prisma } from '../../generated/prisma';

/** Runs the shared filter against real errors from this service's generated Prisma client. */
function render(exception: unknown): { status: number; body: Record<string, unknown> } {
  const out = { status: 0, body: {} as Record<string, unknown> };
  const res: Record<string, jest.Mock> = {};
  res.status = jest.fn((s: number) => ((out.status = s), res));
  res.type = jest.fn(() => res);
  res.json = jest.fn((b: Record<string, unknown>) => ((out.body = b), res));
  const req = { method: 'POST', url: '/workouts', headers: { 'x-correlation-id': 'cid-1' } };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter().catch(exception, host);
  return out;
}

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('db error', { code, clientVersion: 'test' });

describe('AllExceptionsFilter with Prisma errors', () => {
  it.each([
    ['P2002', 409, 'resource.conflict'],
    ['P2003', 409, 'resource.constraint_violation'],
    ['P2025', 404, 'resource.not_found'],
  ])('maps %s to %i', (code, status, title) => {
    const { status: actual, body } = render(prismaError(code));

    expect(actual).toBe(status);
    expect(body).toMatchObject({ title, instance: '/workouts', correlationId: 'cid-1' });
  });

  it('keeps unknown Prisma codes as an opaque 500', () => {
    const { status, body } = render(prismaError('P1001'));

    expect(status).toBe(500);
    expect(body.detail).toBe('An unexpected error occurred.');
  });
});
