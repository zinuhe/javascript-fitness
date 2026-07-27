/**
 * RFC 7807 "Problem Details" error response shape used by every service and the gateway.
 * @see https://datatracker.ietf.org/doc/html/rfc7807
 */
export interface ProblemDetails {
  /** A URI reference that identifies the problem type. */
  type: string;
  /** A short, human-readable summary of the problem type. */
  title: string;
  /** The HTTP status code. */
  status: number;
  /** A human-readable explanation specific to this occurrence. */
  detail?: string;
  /** A URI reference that identifies the specific occurrence (the request path). */
  instance?: string;
  /** Correlation id to trace the request across services and logs. */
  correlationId?: string;
  /** Optional per-field validation errors. */
  errors?: Record<string, string[]>;
}
