// ── Permission check middleware factory ───────────────────────────────
// Creates a middleware that verifies the authenticated API key has the
// required permission scopes before allowing the request to proceed.

import type { MiddlewareHandler } from 'hono';
import { ApiError, ErrorCodes } from '@/server/api/middleware/error-handler';
import type { ApiPermission, ApiVariables } from '@/server/api/types';

/**
 * Factory that returns middleware requiring specific permission scopes.
 *
 * Usage:
 *   app.get('/enrollments', requirePermission('enrollments:read'), handler)
 */
export function requirePermission(
  ...scopes: ApiPermission[]
): MiddlewareHandler<{ Variables: ApiVariables }> {
  return async (c, next) => {
    const permissions = c.get('permissions');

    if (!permissions) {
      throw new ApiError(403, ErrorCodes.FORBIDDEN, 'No permissions found on API key');
    }

    const missing = scopes.filter((s) => !permissions.includes(s));
    if (missing.length > 0) {
      throw new ApiError(
        403,
        ErrorCodes.FORBIDDEN,
        `Missing required permissions: ${missing.join(', ')}`,
      );
    }

    await next();
  };
}
