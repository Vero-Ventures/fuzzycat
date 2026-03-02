// ── API request audit logging middleware ──────────────────────────────
// Logs write operations (POST, PATCH, DELETE) to the audit trail for
// compliance. Read operations (GET) are logged to application logger
// only (structured JSON) to avoid excessive DB writes.

import type { MiddlewareHandler } from 'hono';
import { logger } from '@/lib/logger';
import type { ApiVariables } from '@/server/api/types';
import { logAuditEvent } from '@/server/services/audit';

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const SKIP_PATHS = ['/openapi.json', '/health', '/docs'];

/**
 * Audit middleware that runs AFTER the route handler.
 * - All requests: structured log to application logger
 * - Write requests (POST/PATCH/DELETE): audit log to database
 */
export const apiAuditMiddleware: MiddlewareHandler<{ Variables: ApiVariables }> = async (
  c,
  next,
) => {
  const startTime = Date.now();

  await next();

  // Skip audit for non-authenticated endpoints
  if (SKIP_PATHS.some((p) => c.req.path.endsWith(p))) {
    return;
  }

  const durationMs = Date.now() - startTime;
  const clinicId = c.get('clinicId');
  const method = c.req.method;
  const path = c.req.path;
  const status = c.res.status;
  const ipAddress =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? c.req.header('x-real-ip') ?? null;
  const requestId = c.get('requestId');

  // Structured application log for ALL requests
  logger.info('API request', {
    method,
    path,
    status,
    durationMs,
    clinicId,
    requestId,
    ip: ipAddress,
  });

  // Audit log to database for write operations only (compliance trail)
  if (clinicId && WRITE_METHODS.has(method)) {
    logAuditEvent({
      entityType: 'api_key',
      entityId: clinicId,
      action: 'api_request',
      newValue: { method, path, status, durationMs, requestId },
      actorType: 'clinic',
      actorId: clinicId,
      ipAddress,
    });
  }
};
