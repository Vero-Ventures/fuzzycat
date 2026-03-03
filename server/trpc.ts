import { initTRPC, TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import superjson from 'superjson';
import { getUserRole, type UserRole, VALID_ROLES } from '@/lib/auth';
import { serverEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { isMfaEnabled } from '@/lib/supabase/mfa';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/server/db';
import { clinics, owners } from '@/server/db/schema';

export type { UserRole };

/**
 * tRPC context — created fresh for every request.
 *
 * Reuses auth from middleware-injected headers (x-user-id, x-user-role) when
 * available to skip the redundant Supabase getUser() network round-trip
 * (~100-200ms savings per request). Falls back to getUser() for non-middleware
 * routes (e.g., direct /api/ calls, tests).
 *
 * These headers are set internally by Next.js middleware via
 * NextResponse.next({ request: { headers } }) and cannot be spoofed by clients.
 */
export async function createTRPCContext(opts: { req: Request; resHeaders: Headers }) {
  const supabase = await createClient();

  const middlewareUserId = opts.req.headers.get('x-user-id');
  const middlewareRole = opts.req.headers.get('x-user-role');

  let session: { userId: string; role: UserRole } | null = null;

  if (middlewareUserId && middlewareRole && VALID_ROLES.has(middlewareRole)) {
    session = { userId: middlewareUserId, role: middlewareRole as UserRole };
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    session = user ? { userId: user.id, role: getUserRole(user) } : null;
  }

  return {
    db,
    supabase,
    session,
    requestId: opts.req.headers.get('x-request-id') ?? undefined,
    req: opts.req,
    resHeaders: opts.resHeaders,
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

// ── tRPC rate limiting (per userId) ──────────────────────────────────
// 30 requests per 60s sliding window per authenticated user.
// Falls open when Redis unavailable.

type SimpleRateLimiter = {
  limit: (id: string) => Promise<{ success: boolean }>;
};

let trpcRateLimiter: SimpleRateLimiter | null = null;
let trpcRateLimiterInitialized = false;

async function getTrpcRateLimiter(): Promise<SimpleRateLimiter | null> {
  if (trpcRateLimiterInitialized) return trpcRateLimiter;
  trpcRateLimiterInitialized = true;

  try {
    const env = serverEnv();
    const url = env.UPSTASH_REDIS_REST_URL;
    const token = env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;

    const { Ratelimit } = await import('@upstash/ratelimit');
    const { Redis } = await import('@upstash/redis');
    trpcRateLimiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(30, '60 s'),
      prefix: 'trpc',
    });
    return trpcRateLimiter;
  } catch {
    logger.warn('tRPC rate limiter init failed, falling back to unlimited');
    return null;
  }
}

/**
 * Protected procedure — throws UNAUTHORIZED if no session.
 * Rate-limited to 30 requests per 60s per user (fail-open).
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  // Rate limit per user (fail-open)
  try {
    const limiter = await getTrpcRateLimiter();
    if (limiter) {
      const result = await limiter.limit(ctx.session.userId);
      if (!result.success) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Rate limit exceeded. Please try again shortly.',
        });
      }
    }
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    logger.error('tRPC rate limit check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return next({ ctx: { ...ctx, session: ctx.session } });
});

/**
 * Role-specific procedure factory — throws FORBIDDEN if user role doesn't match.
 * For clinic and admin roles, also enforces MFA (AAL2) at the API layer.
 */
function roleProcedure(...allowedRoles: UserRole[]) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    if (!allowedRoles.includes(ctx.session.role)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
    }

    // Enforce MFA for clinic and admin roles (when enabled)
    if (isMfaEnabled() && (ctx.session.role === 'clinic' || ctx.session.role === 'admin')) {
      const [{ data: mfaFactors }, { data: aal }] = await Promise.all([
        ctx.supabase.auth.mfa.listFactors(),
        ctx.supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);

      const hasTotp = mfaFactors?.totp?.some((f) => f.status === 'verified');
      if (!hasTotp) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'MFA enrollment required',
        });
      }
      if (aal?.currentLevel !== 'aal2') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'MFA verification required',
        });
      }
    }

    return next({ ctx });
  });
}

export const adminProcedure = roleProcedure('admin');

export const clinicProcedure = roleProcedure('clinic', 'admin').use(async ({ ctx, next }) => {
  const [clinic] = await ctx.db
    .select({ id: clinics.id })
    .from(clinics)
    .where(eq(clinics.authId, ctx.session.userId))
    .limit(1);

  if (!clinic && ctx.session.role !== 'admin') {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Clinic profile not found' });
  }

  return next({ ctx: { ...ctx, clinicId: clinic?.id } });
});

export const ownerProcedure = roleProcedure('owner', 'admin').use(async ({ ctx, next }) => {
  const [owner] = await ctx.db
    .select({ id: owners.id })
    .from(owners)
    .where(eq(owners.authId, ctx.session.userId))
    .limit(1);

  if (!owner && ctx.session.role !== 'admin') {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Owner profile not found' });
  }

  return next({ ctx: { ...ctx, ownerId: owner?.id } });
});
