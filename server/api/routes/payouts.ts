// ── Payout REST routes ───────────────────────────────────────────────
// 2 endpoints: list payouts, get earnings summary.
// Uses existing payout service functions.

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { requirePermission } from '@/server/api/middleware/permissions';
import type { ApiVariables } from '@/server/api/types';
import { getClinicEarnings, getClinicPayoutHistory } from '@/server/services/payout';

// ── Response schemas ─────────────────────────────────────────────────

const payoutSummarySchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid().nullable(),
  paymentId: z.string().uuid().nullable(),
  amountCents: z.number().openapi({ example: 19000 }),
  clinicShareCents: z.number().openapi({ example: 570 }),
  stripeTransferId: z.string().nullable().openapi({ example: 'tr_1234567890' }),
  status: z.enum(['pending', 'succeeded', 'failed']).openapi({ example: 'succeeded' }),
  createdAt: z.string().nullable().openapi({ example: '2026-01-15T12:00:00.000Z' }),
});

/** Payout list — has Date fields (createdAt), needs .passthrough() */
const payoutListResponseSchema = z
  .object({
    payouts: z.array(payoutSummarySchema),
    total: z.number().openapi({ example: 42 }),
  })
  .passthrough();

// ── Route definitions ────────────────────────────────────────────────

const listPayoutsRoute = createRoute({
  method: 'get',
  path: '/',
  operationId: 'listPayouts',
  tags: ['Payouts'],
  summary: 'List payout history',
  description: 'Get paginated payout history for your clinic.',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
      offset: z.coerce.number().int().min(0).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Payout list',
      content: { 'application/json': { schema: payoutListResponseSchema } },
    },
  },
});

const getEarningsRoute = createRoute({
  method: 'get',
  path: '/earnings',
  operationId: 'getEarnings',
  tags: ['Payouts'],
  summary: 'Get earnings summary',
  description: 'Get aggregate earnings data for your clinic.',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Earnings summary',
      content: {
        'application/json': {
          schema: z.object({
            totalPayoutCents: z.number(),
            totalClinicShareCents: z.number(),
            pendingPayoutCents: z.number(),
            completedPayoutCount: z.number(),
          }),
        },
      },
    },
  },
});

// ── Route handlers ───────────────────────────────────────────────────

export const payoutRoutes = new OpenAPIHono<{ Variables: ApiVariables }>();

// GET /payouts
payoutRoutes.use('/', requirePermission('payouts:read'));
payoutRoutes.openapi(listPayoutsRoute, async (c) => {
  const query = c.req.valid('query');
  const result = await getClinicPayoutHistory(c.get('clinicId'), {
    limit: query.limit,
    offset: query.offset,
  });
  return c.json(result);
});

// GET /payouts/earnings
payoutRoutes.use('/earnings', requirePermission('payouts:read'));
payoutRoutes.openapi(getEarningsRoute, async (c) => {
  const earnings = await getClinicEarnings(c.get('clinicId'));
  return c.json(earnings);
});
