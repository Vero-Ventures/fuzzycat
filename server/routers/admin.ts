import { z } from 'zod';
import { getAuditLogByEntity, getAuditLogByType } from '@/server/services/audit';
import { getRiskPoolBalance, getRiskPoolHealth } from '@/server/services/guarantee';
import { adminProcedure, router } from '@/server/trpc';

export const adminRouter = router({
  healthCheck: adminProcedure.query(() => {
    return { status: 'ok' as const, router: 'admin' };
  }),

  /**
   * Get risk pool balance breakdown (contributions, claims, recoveries, net).
   */
  riskPoolBalance: adminProcedure.query(async () => {
    return getRiskPoolBalance();
  }),

  /**
   * Get risk pool health metrics (balance, outstanding guarantees,
   * coverage ratio, active plan count).
   */
  riskPoolHealth: adminProcedure.query(async () => {
    return getRiskPoolHealth();
  }),

  /**
   * Get audit log entries for a specific entity.
   */
  auditLogByEntity: adminProcedure
    .input(
      z.object({
        entityType: z.enum(['plan', 'payment', 'payout', 'risk_pool', 'clinic', 'owner']),
        entityId: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      return getAuditLogByEntity(input.entityType, input.entityId);
    }),

  /**
   * Get audit log entries by entity type with pagination.
   */
  auditLogByType: adminProcedure
    .input(
      z.object({
        entityType: z.enum(['plan', 'payment', 'payout', 'risk_pool', 'clinic', 'owner']),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      return getAuditLogByType(input.entityType, {
        limit: input.limit,
        offset: input.offset,
      });
    }),
});
