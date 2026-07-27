import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtAccessPayload } from '@fitness/contracts';

/** Extracts the authenticated user's JWT payload from the request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtAccessPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtAccessPayload }>();
    return request.user;
  },
);
