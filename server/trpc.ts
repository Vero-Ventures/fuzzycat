import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { db } from '@/server/db';

/**
 * tRPC context — created fresh for every request.
 * `session` is null until auth is implemented (#12).
 */
export async function createTRPCContext(opts: { req: Request; resHeaders: Headers }) {
  // TODO: Extract session from request headers/cookies (#12)
  const session: { userId: string; role: 'owner' | 'clinic' | 'admin' } | null = null;

  return {
    db,
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
 * Placeholder until Supabase Auth is wired up (#12).
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});
