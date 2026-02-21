import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { getUserRole, type UserRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/server/db';

export type { UserRole };

/**
 * tRPC context — created fresh for every request.
 * Extracts Supabase session and user role from cookies.
 */
export async function createTRPCContext(opts: { req: Request; resHeaders: Headers }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const session = user
    ? {
        userId: user.id,
        role: getUserRole(user),
      }
    : null;

  return {
    db,
    supabase,
    session,
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

    // Enforce MFA for clinic and admin roles
    const requiresMfa = allowedRoles.some((r) => r === 'clinic' || r === 'admin');
    if (requiresMfa && (ctx.session.role === 'clinic' || ctx.session.role === 'admin')) {
      const { data: mfaFactors } = await ctx.supabase.auth.mfa.listFactors();
      const hasTotp = mfaFactors?.totp?.some((f) => f.status === 'verified');
      if (hasTotp) {
        const { data: aal } = await ctx.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal?.currentLevel !== 'aal2') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'MFA verification required',
          });
        }
      }
    }

    return next({ ctx });
  });
}

export const ownerProcedure = roleProcedure('owner', 'admin');
export const clinicProcedure = roleProcedure('clinic', 'admin');
export const adminProcedure = roleProcedure('admin');
