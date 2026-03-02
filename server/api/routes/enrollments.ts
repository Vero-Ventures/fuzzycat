// ── Enrollment REST routes ───────────────────────────────────────────
// 3 endpoints: create enrollment, get enrollment, cancel enrollment.
// All scoped to the authenticated clinic via API key middleware.

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { and, eq } from 'drizzle-orm';
import { MAX_BILL_CENTS, MIN_BILL_CENTS } from '@/lib/constants';
import { ApiError, ErrorCodes } from '@/server/api/middleware/error-handler';
import { requirePermission } from '@/server/api/middleware/permissions';
import type { ApiVariables } from '@/server/api/types';
import { db } from '@/server/db';
import { plans } from '@/server/db/schema';
import {
  cancelEnrollment,
  createEnrollment,
  getEnrollmentSummary,
} from '@/server/services/enrollment';

// ── Schemas ──────────────────────────────────────────────────────────

const ownerDataSchema = z.object({
  name: z.string().min(1).openapi({ example: 'Jane Doe' }),
  email: z.string().email().openapi({ example: 'jane@example.com' }),
  phone: z.string().min(1).openapi({ example: '+15551234567' }),
  petName: z.string().min(1).openapi({ example: 'Whiskers' }),
  paymentMethod: z.enum(['debit_card', 'bank_account']).openapi({ example: 'debit_card' }),
  addressLine1: z.string().max(200).optional().openapi({ example: '123 Main St' }),
  addressCity: z.string().max(100).optional().openapi({ example: 'San Francisco' }),
  addressState: z.string().max(2).optional().openapi({ example: 'CA' }),
  addressZip: z.string().max(10).optional().openapi({ example: '94105' }),
});

const createEnrollmentSchema = z.object({
  ownerData: ownerDataSchema,
  billAmountCents: z
    .number()
    .int()
    .min(MIN_BILL_CENTS)
    .max(MAX_BILL_CENTS)
    .openapi({ example: 150000 }),
});

const enrollmentResponseSchema = z.object({
  planId: z.string().uuid(),
  ownerId: z.string().uuid(),
  paymentIds: z.array(z.string().uuid()),
});

const enrollmentSummarySchema = z.object({
  plan: z.object({
    id: z.string().uuid(),
    status: z.string(),
    totalBillCents: z.number(),
    feeCents: z.number(),
    totalWithFeeCents: z.number(),
    depositCents: z.number(),
    remainingCents: z.number(),
    installmentCents: z.number(),
    numInstallments: z.number(),
    createdAt: z.string().nullable(),
  }),
  owner: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    petName: z.string(),
  }),
  clinic: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
  payments: z.array(
    z.object({
      id: z.string().uuid(),
      type: z.string(),
      sequenceNum: z.number().nullable(),
      amountCents: z.number(),
      status: z.string(),
      scheduledAt: z.string(),
    }),
  ),
});

const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

// ── Route definitions ────────────────────────────────────────────────

const createEnrollmentRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Enrollments'],
  summary: 'Create a new enrollment',
  description: 'Create a payment plan for a pet owner at your clinic.',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': { schema: createEnrollmentSchema },
      },
    },
  },
  responses: {
    201: {
      description: 'Enrollment created',
      content: { 'application/json': { schema: enrollmentResponseSchema } },
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    422: {
      description: 'Validation failed',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

const getEnrollmentRoute = createRoute({
  method: 'get',
  path: '/{planId}',
  tags: ['Enrollments'],
  summary: 'Get enrollment details',
  description: 'Retrieve full details of an enrollment including payment schedule.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      planId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Enrollment details',
      content: { 'application/json': { schema: enrollmentSummarySchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

const cancelEnrollmentRoute = createRoute({
  method: 'post',
  path: '/{planId}/cancel',
  tags: ['Enrollments'],
  summary: 'Cancel an enrollment',
  description:
    'Cancel an enrollment. Only pending, deposit_paid, or active plans can be cancelled.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      planId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Enrollment cancelled',
      content: {
        'application/json': {
          schema: z.object({ success: z.boolean() }),
        },
      },
    },
    400: {
      description: 'Cannot cancel',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

// ── Route handlers ───────────────────────────────────────────────────

export const enrollmentRoutes = new OpenAPIHono<{ Variables: ApiVariables }>();

// POST /enrollments — Create enrollment
enrollmentRoutes.use('/', requirePermission('enrollments:write'));
enrollmentRoutes.openapi(createEnrollmentRoute, async (c) => {
  const clinicId = c.get('clinicId');
  const body = c.req.valid('json');

  // Reject NY enrollments
  if (body.ownerData.addressState?.toUpperCase() === 'NY') {
    throw new ApiError(
      400,
      ErrorCodes.VALIDATION_ERROR,
      'Payment plans are not currently available in New York state.',
    );
  }

  try {
    const result = await createEnrollment(clinicId, body.ownerData, body.billAmountCents);

    return c.json(result, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create enrollment';
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, message);
  }
});

// GET /enrollments/:planId — Get enrollment details
enrollmentRoutes.use('/:planId', requirePermission('enrollments:read'));
enrollmentRoutes.openapi(getEnrollmentRoute, async (c) => {
  const clinicId = c.get('clinicId');
  const { planId } = c.req.valid('param');

  // Verify the plan belongs to this clinic
  const [plan] = await db
    .select({ id: plans.id })
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.clinicId, clinicId)))
    .limit(1);

  if (!plan) {
    throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Enrollment not found');
  }

  try {
    const summary = await getEnrollmentSummary(planId);

    // Serialize dates to ISO strings for JSON response
    return c.json(
      {
        ...summary,
        plan: {
          ...summary.plan,
          createdAt: summary.plan.createdAt?.toISOString() ?? null,
        },
        payments: summary.payments.map((p) => ({
          ...p,
          scheduledAt: p.scheduledAt.toISOString(),
        })),
      },
      200,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get enrollment';
    throw new ApiError(404, ErrorCodes.NOT_FOUND, message);
  }
});

// POST /enrollments/:planId/cancel — Cancel enrollment
enrollmentRoutes.use('/:planId/cancel', requirePermission('enrollments:write'));
enrollmentRoutes.openapi(cancelEnrollmentRoute, async (c) => {
  const clinicId = c.get('clinicId');
  const { planId } = c.req.valid('param');

  // Verify the plan belongs to this clinic
  const [plan] = await db
    .select({ id: plans.id })
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.clinicId, clinicId)))
    .limit(1);

  if (!plan) {
    throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Enrollment not found');
  }

  try {
    await cancelEnrollment(planId, undefined, 'clinic');
    return c.json({ success: true }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to cancel enrollment';
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, message);
  }
});
