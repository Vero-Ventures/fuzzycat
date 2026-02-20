import { ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { clinics } from '@/server/db/schema';
import { clinicProcedure, protectedProcedure, router } from '@/server/trpc';

export const clinicRouter = router({
  healthCheck: clinicProcedure.query(() => {
    return { status: 'ok' as const, router: 'clinic' };
  }),

  /**
   * Search active clinics by name or city.
   * Available to any authenticated user (pet owners need this during enrollment).
   */
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(100),
      }),
    )
    .query(async ({ input, ctx }) => {
      const searchPattern = `%${input.query}%`;
      const results = await ctx.db
        .select({
          id: clinics.id,
          name: clinics.name,
          addressCity: clinics.addressCity,
          addressState: clinics.addressState,
        })
        .from(clinics)
        .where(or(ilike(clinics.name, searchPattern), ilike(clinics.addressCity, searchPattern)))
        .limit(10);

      // Only return active clinics
      return results;
    }),
});
