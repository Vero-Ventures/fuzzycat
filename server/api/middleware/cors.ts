// ── CORS middleware for external API ──────────────────────────────────
// Allows all origins since this is a public API for POS integrations.
// Handles OPTIONS preflight requests.

import type { MiddlewareHandler } from 'hono';

export const corsMiddleware: MiddlewareHandler = async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id');
  c.header(
    'Access-Control-Expose-Headers',
    'X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset',
  );
  c.header('Access-Control-Max-Age', '86400');

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }

  await next();
};
