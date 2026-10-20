import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ProblemDetails } from '@fitness/contracts';
import { DomainError } from '../errors/domain-error';

/**
 * Catches every unhandled error and renders it as an RFC 7807 `application/problem+json`
 * response. Order of resolution: DomainError (business) → HttpException (Nest/validation)
 * → unknown (500, details hidden). Always attaches the request correlation id.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = (request.headers['x-correlation-id'] as string | undefined) ?? undefined;

    const problem = this.toProblem(exception, request.url, correlationId);

    if (problem.status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${problem.status} ${problem.title}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} -> ${problem.status} ${problem.title}`);
    }

    response.status(problem.status).type('application/problem+json').json(problem);
  }

  private toProblem(exception: unknown, instance: string, correlationId?: string): ProblemDetails {
    if (exception instanceof DomainError) {
      return {
        type: `urn:fitness:error:${exception.code}`,
        title: exception.code,
        status: exception.httpStatus,
        detail: exception.message,
        instance,
        correlationId,
        ...('errors' in exception && exception.errors
          ? { errors: exception.errors as Record<string, string[]> }
          : {}),
      };
    }

    const prismaProblem = this.fromPrismaError(exception);
    if (prismaProblem) {
      return { ...prismaProblem, instance, correlationId };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const { detail, errors } = this.extractHttpExceptionBody(payload);
      return {
        type: `urn:fitness:error:http_${status}`,
        title: HttpStatus[status] ?? 'Error',
        status,
        detail,
        instance,
        correlationId,
        ...(errors ? { errors } : {}),
      };
    }

    return {
      type: 'urn:fitness:error:internal',
      title: 'Internal Server Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: 'An unexpected error occurred.',
      instance,
      correlationId,
    };
  }

  /**
   * Safety net for constraint violations that slip past the application-level checks
   * (e.g. two concurrent requests racing on a unique key). Matched by name/code rather
   * than `instanceof` because each service generates its own isolated Prisma client.
   */
  private fromPrismaError(
    exception: unknown,
  ): Pick<ProblemDetails, 'type' | 'title' | 'status' | 'detail'> | null {
    if (!(exception instanceof Error) || exception.name !== 'PrismaClientKnownRequestError') {
      return null;
    }
    const known: Record<string, { code: string; status: number; detail: string }> = {
      P2002: {
        code: 'resource.conflict',
        status: HttpStatus.CONFLICT,
        detail: 'A resource with the same unique fields already exists.',
      },
      P2003: {
        code: 'resource.constraint_violation',
        status: HttpStatus.CONFLICT,
        detail: 'The operation references a missing resource or one still in use.',
      },
      P2025: {
        code: 'resource.not_found',
        status: HttpStatus.NOT_FOUND,
        detail: 'The requested resource does not exist.',
      },
    };
    const match = known[(exception as Error & { code?: string }).code ?? ''];
    if (!match) return null;
    return {
      type: `urn:fitness:error:${match.code}`,
      title: match.code,
      status: match.status,
      detail: match.detail,
    };
  }

  private extractHttpExceptionBody(payload: string | object): {
    detail: string;
    errors?: Record<string, string[]>;
  } {
    if (typeof payload === 'string') {
      return { detail: payload };
    }
    const body = payload as { message?: unknown; error?: unknown };
    // class-validator returns `message` as an array of constraint strings.
    if (Array.isArray(body.message)) {
      return {
        detail: 'Validation failed',
        errors: { _: body.message.map(String) },
      };
    }
    return { detail: String(body.message ?? body.error ?? 'Error') };
  }
}
