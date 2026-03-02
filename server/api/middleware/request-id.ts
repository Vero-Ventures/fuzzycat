// ── Request ID middleware ─────────────────────────────────────────────
// Generates a unique request ID for every API call and sets it on the
// response header for client-side log correlation.

import { randomUUID } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import type { ApiVariables } from '@/server/api/types';

export const requestIdMiddleware: MiddlewareHandler<{ Variables: ApiVariables }> = async (
  c,
  next,
) => {
  const requestId = c.req.header('x-request-id') ?? randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-Id', requestId);
  await next();
};
