/**
 * Framework-agnostic domain errors. The application/domain layers throw these; the
 * HTTP layer (AllExceptionsFilter) maps them to RFC 7807 responses. This keeps the
 * business logic free of any HTTP/NestJS coupling.
 */
export abstract class DomainError extends Error {
  /** Stable machine-readable code, e.g. `user.email_taken`. */
  abstract readonly code: string;
  /** HTTP status the transport layer should use when surfacing this error. */
  abstract readonly httpStatus: number;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  readonly httpStatus = 404;
  constructor(
    message: string,
    readonly code: string = 'resource.not_found',
  ) {
    super(message);
  }
}

export class ConflictError extends DomainError {
  readonly httpStatus = 409;
  constructor(
    message: string,
    readonly code: string = 'resource.conflict',
  ) {
    super(message);
  }
}

export class ValidationError extends DomainError {
  readonly httpStatus = 422;
  constructor(
    message: string,
    readonly code: string = 'validation.failed',
    readonly errors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export class UnauthorizedError extends DomainError {
  readonly httpStatus = 401;
  constructor(
    message: string,
    readonly code: string = 'auth.unauthorized',
  ) {
    super(message);
  }
}

export class ForbiddenError extends DomainError {
  readonly httpStatus = 403;
  constructor(
    message: string,
    readonly code: string = 'auth.forbidden',
  ) {
    super(message);
  }
}
