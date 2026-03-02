// ── Rate limiting middleware (optional, env-gated) ───────────────────
// Uses @upstash/ratelimit when UPSTASH_REDIS_REST_URL is configured.
// Falls back to an in-memory fixed-window limiter when Redis is unavailable.

import type { MiddlewareHandler } from 'hono';
import { serverEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { ApiError, ErrorCodes } from '@/server/api/middleware/error-handler';
import type { ApiVariables } from '@/server/api/types';

type RateLimiter = {
  limit: (
    id: string,
  ) => Promise<{ success: boolean; limit: number; remaining: number; reset: number }>;
};

/** Simple in-memory fixed-window rate limiter (fallback when Redis unavailable). */
class InMemoryRateLimiter implements RateLimiter {
  private windows = new Map<string, { count: number; resetAt: number }>();
  private maxRequests: number;
  private windowMs: number;
  // Periodic cleanup to prevent memory leaks
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    // Don't keep the process alive just for cleanup
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.windows) {
      if (now >= entry.resetAt) this.windows.delete(key);
    }
  }

  async limit(
    id: string,
  ): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
    const now = Date.now();
    const entry = this.windows.get(id);

    if (!entry || now >= entry.resetAt) {
      this.windows.set(id, { count: 1, resetAt: now + this.windowMs });
      return {
        success: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - 1,
        reset: Math.ceil((now + this.windowMs) / 1000),
      };
    }

    entry.count++;
    const remaining = Math.max(0, this.maxRequests - entry.count);
    return {
      success: entry.count <= this.maxRequests,
      limit: this.maxRequests,
      remaining,
      reset: Math.ceil(entry.resetAt / 1000),
    };
  }
}

/** Attempt to create an Upstash-backed rate limiter from env vars. */
async function initLimiter(): Promise<RateLimiter> {
  try {
    const env = serverEnv();
    const url = env.UPSTASH_REDIS_REST_URL;
    const token = env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      logger.info('Rate limiter: using in-memory fallback (Redis not configured)');
      return new InMemoryRateLimiter(100, 60_000);
    }

    const { Ratelimit } = await import('@upstash/ratelimit');
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({ url, token });
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '60 s'),
      prefix: 'api_v1',
    });
  } catch {
    logger.info('Rate limiter: using in-memory fallback (Redis not configured)');
    return new InMemoryRateLimiter(100, 60_000);
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

    // limiter is always non-null after initLimiter (falls back to in-memory)
    const activeLimiter = limiter as RateLimiter;
    const identifier = c.get('clinicId') ?? c.req.header('x-forwarded-for') ?? 'anonymous';
    const result = await activeLimiter.limit(identifier);

    c.header('X-RateLimit-Limit', String(result.limit));
    c.header('X-RateLimit-Remaining', String(result.remaining));
    c.header('X-RateLimit-Reset', String(result.reset));

    if (!result.success) {
      throw new ApiError(429, ErrorCodes.RATE_LIMITED, 'Rate limit exceeded. Try again later.');
    }

    await next();
  };
}
