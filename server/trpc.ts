import { initTRPC, TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import superjson from 'superjson';
import { getUserRole, type UserRole } from '@/lib/auth';
import { isMfaEnabled } from '@/lib/supabase/mfa';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/server/db';
import { clinics, owners } from '@/server/db/schema';

export type { UserRole };

const VALID_ROLES: ReadonlySet<string> = new Set<UserRole>(['owner', 'clinic', 'admin']);

/**
 * tRPC context — created fresh for every request.
 * Reuses auth from middleware headers when available to avoid redundant getUser() calls.
 */
export async function createTRPCContext(opts: { req: Request; resHeaders: Headers }) {
  const supabase = await createClient();

  // Reuse auth from middleware headers to avoid redundant getUser() (~100-200ms)
  const middlewareUserId = opts.req.headers.get('x-user-id');
  const middlewareRole = opts.req.headers.get('x-user-role');

  let session: { userId: string; role: UserRole } | null = null;

  if (middlewareUserId && middlewareRole && VALID_ROLES.has(middlewareRole)) {
    session = { userId: middlewareUserId, role: middlewareRole as UserRole };
  } else {
    // Fallback: validate via Supabase (non-middleware routes, tests, etc.)
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

/**
 * Protected procedure — throws UNAUTHORIZED if no session.
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
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
      const { data: mfaFactors } = await ctx.supabase.auth.mfa.listFactors();
      const hasTotp = mfaFactors?.totp?.some((f) => f.status === 'verified');
      if (!hasTotp) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'MFA enrollment required',
        });
      }
      const { data: aal } = await ctx.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
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
