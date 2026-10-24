// Typed errors of the API layer. Every failure of a request becomes one of
// these, so that screens branch on types and problem slugs, never on text
// (the core returns application/problem+json with a stable `type`, RFC 9457).
import type { Problem, ProblemType } from '@/api/types';

/** The instance could not be reached (no network, DNS, TLS, refused) or did not answer in time. */
export class NetworkError extends Error {
  override readonly name = 'NetworkError';
  constructor(
    readonly reason: 'unreachable' | 'timeout',
    options?: { cause?: unknown },
  ) {
    super(`instance ${reason}`, options);
  }
}

/** The instance answered with something that is not the expected JSON. */
export class UnexpectedResponseError extends Error {
  override readonly name = 'UnexpectedResponseError';
  constructor(readonly status: number) {
    super(`unexpected response (HTTP ${status})`);
  }
}

/** A non-2xx answer, with the problem+json body when there is one. */
export class ProblemError extends Error {
  override readonly name: string = 'ProblemError';
  /** Stable problem slug, or "unknown" when the body is not a problem. */
  readonly type: ProblemType | 'unknown';
  constructor(
    readonly status: number,
    readonly problem: Problem | null,
  ) {
    super(`HTTP ${status}${problem ? ` ${problem.type}` : ''}`);
    this.type = problem?.type ?? 'unknown';
  }
}

/** HTTP 401: the device token is missing, revoked or expired. */
export class UnauthorizedError extends ProblemError {
  override readonly name = 'UnauthorizedError';
}

/**
 * The instance uses a self-signed certificate (desktop LAN mode). React
 * Native cannot pin it yet: the pinned native transport is planned in ADR 0006.
 */
export class LanTransportUnavailableError extends Error {
  override readonly name = 'LanTransportUnavailableError';
  constructor() {
    super('pinned transport for self-signed certificates is not available yet');
  }
}

function isProblem(body: unknown): body is Problem {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b.type === 'string' && typeof b.status === 'number';
}

/** Builds the typed error for a non-2xx response and its (already parsed) body. */
export function errorForStatus(status: number, body: unknown): ProblemError {
  const problem = isProblem(body) ? body : null;
  return status === 401
    ? new UnauthorizedError(status, problem)
    : new ProblemError(status, problem);
}

export const isUnauthorized = (e: unknown): e is UnauthorizedError =>
  e instanceof UnauthorizedError;
