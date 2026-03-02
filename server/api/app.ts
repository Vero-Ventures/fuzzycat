// ── Hono API app factory ─────────────────────────────────────────────
// Creates the OpenAPIHono app with middleware stack and route groups.
// Both the Next.js catch-all and tests use this factory.

import { OpenAPIHono } from '@hono/zod-openapi';
import { authMiddleware } from '@/server/api/middleware/auth';
import { corsMiddleware } from '@/server/api/middleware/cors';
import { errorHandler } from '@/server/api/middleware/error-handler';
import { createRateLimitMiddleware } from '@/server/api/middleware/rate-limit';
import { requestIdMiddleware } from '@/server/api/middleware/request-id';
import { enrollmentRoutes } from '@/server/api/routes/enrollments';
import type { ApiVariables } from '@/server/api/types';

export function createApiApp() {
  const app = new OpenAPIHono<{ Variables: ApiVariables }>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Request validation failed',
              details: result.error.flatten(),
            },
          },
          422,
        );
      }
    },
  });

  // ── Global middleware (order matters) ────────────────────────────
  app.use('*', requestIdMiddleware);
  app.use('*', corsMiddleware);
  app.use('*', createRateLimitMiddleware());
  app.use('*', authMiddleware);

  // ── Global error handler ────────────────────────────────────────
  app.onError(errorHandler);

  // ── Health check ────────────────────────────────────────────────
  app.get('/health', (c) => c.json({ status: 'ok', api: 'v1' }));

  // ── Route groups ────────────────────────────────────────────────
  app.route('/enrollments', enrollmentRoutes);

  // ── OpenAPI spec ────────────────────────────────────────────────
  app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'FuzzyCat API',
      version: '1.0.0',
      description: 'External REST API for veterinary clinic POS integrations',
    },
    servers: [{ url: '/api/v1', description: 'API v1' }],
    security: [{ bearerAuth: [] }],
  });

  return app;
}
