import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/server/db';

export type UserRole = 'owner' | 'clinic' | 'admin';

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
        role: ((user.app_metadata?.role as string) ?? 'owner') as UserRole,
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
 */
function roleProcedure(...allowedRoles: UserRole[]) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    if (!allowedRoles.includes(ctx.session.role)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
    }
    return next({ ctx });
  });
}

export const ownerProcedure = roleProcedure('owner', 'admin');
export const clinicProcedure = roleProcedure('clinic', 'admin');
export const adminProcedure = roleProcedure('admin');
