// ── Rate limiting middleware (optional, env-gated) ───────────────────
// Uses @upstash/ratelimit when UPSTASH_REDIS_REST_URL is configured.
// When not configured, this middleware is a no-op passthrough.

import type { MiddlewareHandler } from 'hono';
import { ApiError, ErrorCodes } from '@/server/api/middleware/error-handler';
import type { ApiVariables } from '@/server/api/types';

type RateLimiter = {
  limit: (
    id: string,
  ) => Promise<{ success: boolean; limit: number; remaining: number; reset: number }>;
};

/** Attempt to create an Upstash-backed rate limiter from env vars. */
async function initLimiter(): Promise<RateLimiter | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const { Ratelimit } = await import('@upstash/ratelimit');
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({ url, token });
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '60 s'),
      prefix: 'api_v1',
    });
  } catch {
    return null;
  }
}

const SKIP_PATHS = ['/openapi.json', '/health'];

/**
 * Rate limit middleware factory.
 * Returns a no-op if Upstash credentials are not configured.
 * When active, limits to 100 requests per 60-second window per clinic.
 */
export function createRateLimitMiddleware(): MiddlewareHandler<{ Variables: ApiVariables }> {
  let limiter: RateLimiter | null = null;
  let initialized = false;

  return async (c, next) => {
    if (SKIP_PATHS.some((p) => c.req.path.endsWith(p))) {
      await next();
      return;
    }

    if (!initialized) {
      initialized = true;
      limiter = await initLimiter();
    }

    if (!limiter) {
      await next();
      return;
    }

    const identifier = c.get('clinicId') ?? c.req.header('x-forwarded-for') ?? 'anonymous';
    const result = await limiter.limit(identifier);

    c.header('X-RateLimit-Limit', String(result.limit));
    c.header('X-RateLimit-Remaining', String(result.remaining));
    c.header('X-RateLimit-Reset', String(result.reset));

    if (!result.success) {
      throw new ApiError(429, ErrorCodes.RATE_LIMITED, 'Rate limit exceeded. Try again later.');
    }

    await next();
  };
}
