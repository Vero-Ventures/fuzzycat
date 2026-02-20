import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { headers } from 'next/headers';
import { logger } from '@/lib/logger';

/**
 * Sliding-window rate limiter backed by Upstash Redis.
 *
 * Allows 5 requests per 60-second window per IP.  When Upstash env vars
 * are not configured (local dev), all requests are allowed.
 */

let ratelimit: Ratelimit | null = null;

function getRatelimit(): Ratelimit | null {
  if (ratelimit) return ratelimit;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(5, '60 s'),
    analytics: true,
    prefix: 'fuzzycat:ratelimit',
  });

  return ratelimit;
}

/**
 * Check rate limit for the current request IP.
 * Returns `{ success: true }` if allowed, `{ success: false }` if blocked.
 * Always allows in development when Upstash is not configured.
 */
export async function checkRateLimit(identifier?: string): Promise<{ success: boolean }> {
  const limiter = getRatelimit();
  if (!limiter) return { success: true };

  const headersList = await headers();
  const ip = identifier ?? headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  try {
    const result = await limiter.limit(ip);
    if (!result.success) {
      logger.warn('Rate limit exceeded', { ip, remaining: result.remaining });
    }
    return { success: result.success };
  } catch (error) {
    logger.error('Rate limit check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Fail open — don't block users if Redis is down
    return { success: true };
  }
}
