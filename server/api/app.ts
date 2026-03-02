// ── Hono API app factory ─────────────────────────────────────────────
// Creates the OpenAPIHono app with middleware stack and route groups.
// Both the Next.js catch-all and tests use this factory.

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { apiAuditMiddleware } from '@/server/api/middleware/audit';
import { authMiddleware } from '@/server/api/middleware/auth';
import { corsMiddleware } from '@/server/api/middleware/cors';
import { errorHandler } from '@/server/api/middleware/error-handler';
import { createRateLimitMiddleware } from '@/server/api/middleware/rate-limit';
import { requestIdMiddleware } from '@/server/api/middleware/request-id';
import { clinicRoutes } from '@/server/api/routes/clinic';
import { enrollmentRoutes } from '@/server/api/routes/enrollments';
import { payoutRoutes } from '@/server/api/routes/payouts';
import type { ApiVariables } from '@/server/api/types';

const API_DESCRIPTION = `
# FuzzyCat External REST API

REST API for veterinary clinic POS integrations. Manage payment plan enrollments,
view clinic data, track payouts, and export reports programmatically.

## Authentication

All endpoints (except \`/health\` and \`/openapi.json\`) require a Bearer token.

\`\`\`
Authorization: Bearer fc_live_<32-hex-chars>
\`\`\`

### Obtaining an API Key

1. Log in to the **Clinic Portal** at [fuzzycatapp.com](https://www.fuzzycatapp.com)
2. Navigate to **Settings → API Keys**
3. Click **Create Key**, name it, and select the permission scopes you need
4. Copy the key immediately — it is shown only once and cannot be retrieved later

### Revoking a Key

Revoke keys from the same Settings page. Revocation is immediate and permanent.

## Permission Scopes

Each API key is granted specific scopes at creation:

| Scope | Access |
|-------|--------|
| \`enrollments:read\` | View enrollment details |
| \`enrollments:write\` | Create and cancel enrollments |
| \`clinic:read\` | View clinic profile, stats, and revenue |
| \`clinic:write\` | Update clinic profile |
| \`clients:read\` | View client and plan details |
| \`export:read\` | Download CSV exports |
| \`payouts:read\` | View payout history and earnings |

A request to an endpoint without the required scope returns \`403 Forbidden\`.

## Rate Limiting

When rate limiting is active, each clinic is allowed **100 requests per 60-second
sliding window**. Responses include these headers:

| Header | Description |
|--------|-------------|
| \`X-RateLimit-Limit\` | Maximum requests per window (100) |
| \`X-RateLimit-Remaining\` | Requests remaining in the current window |
| \`X-RateLimit-Reset\` | Unix timestamp when the window resets |

Exceeding the limit returns \`429 Too Many Requests\`.

## Error Format

All errors follow a consistent structure:

\`\`\`json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": {}
  }
}
\`\`\`

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| \`VALIDATION_ERROR\` | 400 / 422 | Invalid request body or parameters |
| \`UNAUTHORIZED\` | 401 | Missing or invalid API key |
| \`FORBIDDEN\` | 403 | Valid key but insufficient permissions |
| \`NOT_FOUND\` | 404 | Resource does not exist or not owned by your clinic |
| \`RATE_LIMITED\` | 429 | Too many requests |
| \`INTERNAL_ERROR\` | 500 | Unexpected server error |

## Monetary Values

All monetary amounts are in **integer cents** (USD). For example, \`150000\` = $1,500.00.

## Request Tracing

Every response includes an \`X-Request-Id\` header (UUID). Include this when
contacting support for request-level debugging.
`.trim();

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['System'],
  summary: 'Health check',
  description: 'Returns API health status. No authentication required.',
  security: [],
  responses: {
    200: {
      description: 'API is healthy',
      content: {
        'application/json': {
          schema: z.object({
            status: z.literal('ok'),
            api: z.literal('v1'),
          }),
        },
      },
    },
  },
});

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
  app.use('*', apiAuditMiddleware);

  // ── Global error handler ────────────────────────────────────────
  app.onError(errorHandler);

  // ── Health check ────────────────────────────────────────────────
  app.openapi(healthRoute, (c) => c.json({ status: 'ok' as const, api: 'v1' as const }, 200));

  // ── Route groups ────────────────────────────────────────────────
  app.route('/enrollments', enrollmentRoutes);
  app.route('/clinic', clinicRoutes);
  app.route('/payouts', payoutRoutes);

  // ── OpenAPI spec ────────────────────────────────────────────────
  app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'FuzzyCat API',
      version: '1.0.0',
      description: API_DESCRIPTION,
    },
    servers: [{ url: '/api/v1', description: 'API v1' }],
    security: [{ bearerAuth: [] }],
    'x-tagGroups': [
      { name: 'System', tags: ['System'] },
      { name: 'Enrollments', tags: ['Enrollments'] },
      { name: 'Clinic', tags: ['Clinic'] },
      { name: 'Payouts', tags: ['Payouts'] },
    ],
  });

  // ── Scalar API docs UI ──────────────────────────────────────────
  app.get('/docs', (c) => {
    return c.html(`<!doctype html>
<html>
<head>
  <title>FuzzyCat API Reference</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <script id="api-reference" data-url="/api/v1/openapi.json"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`);
  });

  return app;
}
