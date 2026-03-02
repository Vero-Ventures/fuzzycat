// ── Standardized error handler for external API ─────────────────────
// Returns consistent JSON error responses:
//   { error: { code: string, message: string, details?: unknown } }

import type { ErrorHandler } from 'hono';
import { logger } from '@/lib/logger';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Custom error class for API errors with HTTP status codes.
 */
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Map of common error codes to their meanings. */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export const errorHandler: ErrorHandler = (err, c) => {
  const requestId = c.get('requestId' as never) ?? 'unknown';

  if (err instanceof ApiError) {
    logger.warn('API error', {
      requestId,
      code: err.code,
      statusCode: err.statusCode,
      message: err.message,
    });

    return c.json<ApiErrorBody>(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details !== undefined && { details: err.details }),
        },
      },
      err.statusCode as 400,
    );
  }

  // Unexpected errors — log full details, return sanitized response
  logger.error('Unhandled API error', {
    requestId,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  return c.json<ApiErrorBody>(
    {
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'An internal error occurred',
      },
    },
    500,
  );
};
