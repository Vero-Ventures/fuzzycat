import { revalidateTag as nextRevalidateTag, unstable_cache } from 'next/cache';

/**
 * Invalidate cached data by tag.
 * Wrapper around Next.js revalidateTag with the default cache life profile.
 * No-ops outside the Next.js server runtime (e.g., in tests).
 *
 * @param tag - Cache tag to invalidate (e.g., "clinic:123:profile")
 */
export function revalidateTag(tag: string): void {
  try {
    nextRevalidateTag(tag, 'default');
  } catch {
    // Outside Next.js runtime (tests, scripts) — silently skip
  }
}

/**
 * Cached wrapper for database queries.
 * Uses Next.js unstable_cache for server-side caching with tag-based revalidation.
 * Falls back to direct execution outside the Next.js server runtime (e.g., in tests).
 *
 * Tier 1 (conservative): clinic profiles, owner profiles, admin clinic list.
 * NEVER cache financial/payment data, auth data, or session data.
 *
 * @param fn - Async function that fetches data (e.g., a Drizzle query)
 * @param keyParts - Unique cache key parts (must include entity IDs for user-scoped data)
 * @param options - Cache options: `revalidate` (TTL in seconds), `tags` (for invalidation)
 */
export async function cachedQuery<T>(
  fn: () => Promise<T>,
  keyParts: string[],
  options: { revalidate?: number; tags?: string[] },
): Promise<T> {
  try {
    return await unstable_cache(fn, keyParts, options)();
  } catch {
    // Outside Next.js runtime (tests, scripts) — fall back to direct call
    return fn();
  }
}
