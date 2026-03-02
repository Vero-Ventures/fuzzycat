// ── Idempotency key middleware ─────────────────────────────────────────
// Deduplicates POST requests using an Idempotency-Key header.
// If the same (clinicId, key) pair is seen again, returns the cached response.
// Keys expire after 24 hours.
//
// Race safety: We INSERT a placeholder row BEFORE processing the request.
// If a concurrent request sees the placeholder (no responseBody yet), it
// returns 409 Conflict. This prevents dual execution of the handler.

import { and, eq, isNull } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { logger } from '@/lib/logger';
import type { ApiVariables } from '@/server/api/types';
import { db } from '@/server/db';
import { idempotencyKeys } from '@/server/db/schema';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const CONFLICT_BODY = {
  error: {
    code: 'CONFLICT',
    message: 'A request with this idempotency key is already being processed',
  },
} as const;

/** Validate key format: 1–256 printable ASCII characters. */
function isValidKey(key: string): boolean {
  if (key.length === 0 || key.length > 256) return false;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control char filter
  return !/[\x00-\x1f\x7f]/.test(key);
}

/** Cache the response body in the placeholder row, or clean up on failure. */
async function cacheResponse(placeholderId: string, status: number, res: Response): Promise<void> {
  if (status >= 200 && status < 300) {
    try {
      const body = await res.clone().json();
      await db
        .update(idempotencyKeys)
        .set({ responseStatus: status, responseBody: body })
        .where(and(eq(idempotencyKeys.id, placeholderId), isNull(idempotencyKeys.responseBody)));
    } catch {
      await removePlaceholder(placeholderId);
    }
  } else {
    await removePlaceholder(placeholderId);
  }
}

async function removePlaceholder(id: string): Promise<void> {
  await db
    .delete(idempotencyKeys)
    .where(eq(idempotencyKeys.id, id))
    .catch((error) => {
      logger.error('Failed to remove idempotency key placeholder', {
        placeholderId: id,
        error: error instanceof Error ? error.message : String(error),
      });
    });
}

/**
 * Middleware that checks for an Idempotency-Key header on POST requests.
 * - If the key exists with a cached response, returns it.
 * - If the key exists without a response (in-flight), returns 409 Conflict.
 * - If the key is new, inserts a placeholder, processes the request, and caches.
 * - Non-POST requests and requests without the header pass through unchanged.
 */
export const idempotencyMiddleware: MiddlewareHandler<{ Variables: ApiVariables }> = async (
  c,
  next,
) => {
  if (c.req.method !== 'POST') {
    await next();
    return;
  }

  const key = c.req.header('idempotency-key');
  if (!key) {
    await next();
    return;
  }

  if (!isValidKey(key)) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Idempotency-Key must be 1-256 printable ASCII characters',
        },
      },
      400,
    );
  }

  const clinicId = c.get('clinicId');
  if (!clinicId) {
    await next();
    return;
  }

  // Check for existing cached response
  const [existing] = await db
    .select()
    .from(idempotencyKeys)
    .where(and(eq(idempotencyKeys.clinicId, clinicId), eq(idempotencyKeys.idempotencyKey, key)))
    .limit(1);

  if (existing) {
    if (existing.expiresAt < new Date()) {
      await db.delete(idempotencyKeys).where(eq(idempotencyKeys.id, existing.id));
    } else if (existing.responseBody === null) {
      return c.json(CONFLICT_BODY, 409);
    } else {
      c.res = new Response(JSON.stringify(existing.responseBody), {
        status: existing.responseStatus,
        headers: { 'Content-Type': 'application/json', 'Idempotent-Replayed': 'true' },
      });
      return;
    }
  }

  // Insert placeholder BEFORE processing (race-safe via unique constraint)
  let placeholderId: string;
  try {
    const [inserted] = await db
      .insert(idempotencyKeys)
      .values({
        clinicId,
        idempotencyKey: key,
        httpMethod: c.req.method,
        httpPath: c.req.path,
        responseStatus: 0,
        responseBody: null,
        expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
      })
      .returning({ id: idempotencyKeys.id });
    placeholderId = inserted.id;
  } catch {
    return c.json(CONFLICT_BODY, 409);
  }

  await next();
  await cacheResponse(placeholderId, c.res.status, c.res);
};
