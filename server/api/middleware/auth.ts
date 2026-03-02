// ── API key authentication middleware ─────────────────────────────────
// Parses the Bearer token from the Authorization header, validates it
// via the API key service, and sets clinicId + permissions on context.

import type { MiddlewareHandler } from 'hono';
import { ApiError, ErrorCodes } from '@/server/api/middleware/error-handler';
import type { ApiVariables } from '@/server/api/types';
import { validateApiKey } from '@/server/services/api-key';

/**
 * Authentication middleware for external API routes.
 * Expects: `Authorization: Bearer fc_live_...`
 *
 * Skips auth for the OpenAPI spec and health check endpoints.
 * Passes client IP for allowlist checking.
 */
export const authMiddleware: MiddlewareHandler<{ Variables: ApiVariables }> = async (c, next) => {
  // Skip auth for OpenAPI spec, health check, and docs
  const path = c.req.path;
  if (path.endsWith('/openapi.json') || path.endsWith('/health') || path.endsWith('/docs')) {
    await next();
    return;
  }

  const authHeader = c.req.header('authorization');
  if (!authHeader) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Missing Authorization header');
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Invalid Authorization header format');
  }

  const token = match[1];

  // Extract client IP for allowlist validation
  const ipAddress =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('x-real-ip') ??
    undefined;

  const result = await validateApiKey(token, { ipAddress });

  if (!result) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Invalid or revoked API key');
  }

  c.set('clinicId', result.clinicId);
  c.set('apiKeyId', result.id);
  c.set('permissions', result.permissions);

  await next();
};
