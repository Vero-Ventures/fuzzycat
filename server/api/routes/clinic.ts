// ── Clinic REST routes ───────────────────────────────────────────────
// 14 endpoints for clinic data: profile, stats, clients, revenue, exports.
// All scoped to the authenticated clinic via API key middleware.

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { ApiError, ErrorCodes } from '@/server/api/middleware/error-handler';
import { requirePermission } from '@/server/api/middleware/permissions';
import type { ApiVariables } from '@/server/api/types';
import {
  exportClientsCSV,
  exportPayoutsCSV,
  exportRevenueCSV,
  getClientDetails,
  getClientPlanDetails,
  getClientStats,
  getClients,
  getClinicProfile,
  getDashboardStats,
  getDefaultRate,
  getEnrollmentTrends,
  getMonthlyRevenue,
  getRevenueReport,
  updateClinicProfile,
} from '@/server/services/clinic-queries';

// ── Shared schemas ───────────────────────────────────────────────────

const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

// ── Response schemas ─────────────────────────────────────────────────

const clinicProfileSchema = z.object({
  id: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
  name: z.string().openapi({ example: 'Happy Paws Veterinary' }),
  email: z.string().email().openapi({ example: 'clinic@happypaws.com' }),
  phone: z.string().nullable().openapi({ example: '+15551234567' }),
  addressLine1: z.string().nullable().openapi({ example: '123 Main St' }),
  addressCity: z.string().nullable().openapi({ example: 'Austin' }),
  addressState: z.string().nullable().openapi({ example: 'TX' }),
  addressZip: z.string().nullable().openapi({ example: '78701' }),
  stripeAccountId: z.string().nullable().openapi({ example: 'acct_1234567890' }),
  status: z.string().openapi({ example: 'active' }),
});

const recentEnrollmentSchema = z.object({
  id: z.string().uuid(),
  ownerName: z.string().nullable(),
  petName: z.string().nullable(),
  totalBillCents: z.number().openapi({ example: 150000 }),
  status: z.string().openapi({ example: 'active' }),
  createdAt: z.string().nullable().openapi({ example: '2026-01-15T12:00:00.000Z' }),
});

/** Dashboard stats — has Date fields in recentEnrollments, needs .passthrough() */
const dashboardStatsSchema = z
  .object({
    activePlans: z.number().openapi({ example: 12 }),
    completedPlans: z.number().openapi({ example: 45 }),
    defaultedPlans: z.number().openapi({ example: 2 }),
    totalPlans: z.number().openapi({ example: 59 }),
    totalRevenueCents: z.number().openapi({ example: 850000 }),
    totalPayoutCents: z.number().openapi({ example: 7500000 }),
    pendingPayoutsCount: z.number().openapi({ example: 3 }),
    pendingPayoutsCents: z.number().openapi({ example: 450000 }),
    recentEnrollments: z.array(recentEnrollmentSchema),
  })
  .passthrough();

const clientStatsSchema = z.object({
  activePlans: z.number().openapi({ example: 5 }),
  totalOutstandingCents: z.number().openapi({ example: 250000 }),
  defaultRate: z.number().openapi({ example: 2.5 }),
});

const defaultRateSchema = z.object({
  totalPlans: z.number().openapi({ example: 50 }),
  defaultedPlans: z.number().openapi({ example: 2 }),
  defaultRate: z.number().openapi({ example: 4.0 }),
});

const enrollmentTrendSchema = z.object({
  month: z.string().openapi({ example: '2026-01' }),
  enrollments: z.number().openapi({ example: 8 }),
});

const clientRowSchema = z.object({
  planId: z.string().uuid(),
  ownerName: z.string().nullable(),
  ownerEmail: z.string().nullable(),
  ownerPhone: z.string().nullable(),
  petName: z.string().nullable(),
  totalBillCents: z.number().openapi({ example: 150000 }),
  totalWithFeeCents: z.number().openapi({ example: 159000 }),
  planStatus: z.string().openapi({ example: 'active' }),
  nextPaymentAt: z.string().nullable().openapi({ example: '2026-02-01T00:00:00.000Z' }),
  createdAt: z.string().nullable().openapi({ example: '2026-01-15T12:00:00.000Z' }),
  totalPaidCents: z.number().openapi({ example: 39750 }),
});

/** Clients list — has Date fields (nextPaymentAt, createdAt), needs .passthrough() */
const clientsResponseSchema = z
  .object({
    clients: z.array(clientRowSchema),
    pagination: z.object({
      page: z.number().openapi({ example: 1 }),
      pageSize: z.number().openapi({ example: 20 }),
      totalCount: z.number().openapi({ example: 42 }),
      totalPages: z.number().openapi({ example: 3 }),
    }),
  })
  .passthrough();

const clientPlanSchema = z.object({
  id: z.string().uuid(),
  totalBillCents: z.number(),
  totalWithFeeCents: z.number(),
  depositCents: z.number(),
  installmentCents: z.number(),
  numInstallments: z.number(),
  status: z.string(),
  createdAt: z.string().nullable(),
  petName: z.string().nullable(),
  totalPaidCents: z.number(),
});

/** Client details — has Date fields (plans[].createdAt, clientSince), needs .passthrough() */
const clientDetailsSchema = z
  .object({
    owner: z.object({
      name: z.string().nullable(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      petName: z.string().nullable(),
    }),
    plans: z.array(clientPlanSchema),
    clientSince: z.string().nullable().openapi({ example: '2026-01-15T12:00:00.000Z' }),
  })
  .passthrough();

const planDetailSchema = z.object({
  id: z.string().uuid(),
  clinicId: z.string().uuid().nullable(),
  totalBillCents: z.number(),
  feeCents: z.number(),
  totalWithFeeCents: z.number(),
  depositCents: z.number(),
  remainingCents: z.number(),
  installmentCents: z.number(),
  numInstallments: z.number(),
  status: z.string(),
  depositPaidAt: z.string().nullable(),
  nextPaymentAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  ownerName: z.string().nullable(),
  ownerEmail: z.string().nullable(),
  ownerPhone: z.string().nullable(),
  petName: z.string().nullable(),
});

const paymentDetailSchema = z.object({
  id: z.string().uuid(),
  type: z.string().openapi({ example: 'installment' }),
  sequenceNum: z.number().nullable().openapi({ example: 1 }),
  amountCents: z.number().openapi({ example: 19875 }),
  status: z.string().openapi({ example: 'succeeded' }),
  scheduledAt: z.string().openapi({ example: '2026-02-01T00:00:00.000Z' }),
  processedAt: z.string().nullable().openapi({ example: '2026-02-01T12:30:00.000Z' }),
  failureReason: z.string().nullable(),
  retryCount: z.number().nullable().openapi({ example: 0 }),
});

const payoutDetailSchema = z.object({
  id: z.string().uuid(),
  amountCents: z.number().openapi({ example: 19000 }),
  clinicShareCents: z.number().openapi({ example: 570 }),
  stripeTransferId: z.string().nullable().openapi({ example: 'tr_1234567890' }),
  status: z.string().openapi({ example: 'succeeded' }),
  createdAt: z.string().nullable().openapi({ example: '2026-02-01T12:30:00.000Z' }),
});

/** Plan details — has many Date fields, needs .passthrough() */
const planDetailsResponseSchema = z
  .object({
    plan: planDetailSchema,
    payments: z.array(paymentDetailSchema),
    payouts: z.array(payoutDetailSchema),
  })
  .passthrough();

const monthlyRevenueSchema = z.object({
  month: z.string().openapi({ example: '2026-01' }),
  totalPayoutCents: z.number().openapi({ example: 500000 }),
  totalShareCents: z.number().openapi({ example: 15000 }),
  payoutCount: z.number().openapi({ example: 10 }),
});

const revenueReportSchema = z.object({
  month: z.string().openapi({ example: '2026-01' }),
  enrollments: z.number().openapi({ example: 8 }),
  revenueCents: z.number().openapi({ example: 500000 }),
  payoutsCents: z.number().openapi({ example: 500000 }),
  clinicShareCents: z.number().openapi({ example: 15000 }),
});

// ── Route definitions ────────────────────────────────────────────────

const getProfileRoute = createRoute({
  method: 'get',
  path: '/profile',
  operationId: 'getClinicProfile',
  tags: ['Clinic'],
  summary: 'Get clinic profile',
  description:
    'Retrieve your clinic profile including name, contact info, and Stripe account status.',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Clinic profile',
      content: { 'application/json': { schema: clinicProfileSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

const updateProfileRoute = createRoute({
  method: 'patch',
  path: '/profile',
  operationId: 'updateClinicProfile',
  tags: ['Clinic'],
  summary: 'Update clinic profile',
  description: 'Update clinic contact information. Only provided fields are changed.',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(1).optional(),
            phone: z
              .string()
              .regex(/^\+[1-9]\d{1,14}$/)
              .optional(),
            addressLine1: z.string().min(1).optional(),
            addressCity: z.string().min(1).optional(),
            addressState: z.string().length(2).optional(),
            addressZip: z.string().min(5).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated profile',
      content: { 'application/json': { schema: clinicProfileSchema } },
    },
    400: {
      description: 'Bad request',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

const getStatsRoute = createRoute({
  method: 'get',
  path: '/stats',
  operationId: 'getDashboardStats',
  tags: ['Clinic'],
  summary: 'Get dashboard statistics',
  description:
    'Get aggregate dashboard statistics including plan counts, revenue totals, and recent enrollments.',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Dashboard stats',
      content: { 'application/json': { schema: dashboardStatsSchema } },
    },
  },
});

const getClientStatsRoute = createRoute({
  method: 'get',
  path: '/stats/clients',
  operationId: 'getClientStats',
  tags: ['Clinic'],
  summary: 'Get client statistics',
  description:
    'Get client-level statistics including active plans, outstanding balances, and default rate.',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Client stats',
      content: { 'application/json': { schema: clientStatsSchema } },
    },
  },
});

const getDefaultsRoute = createRoute({
  method: 'get',
  path: '/stats/defaults',
  operationId: 'getDefaultRate',
  tags: ['Clinic'],
  summary: 'Get default rate',
  description:
    'Get the overall default rate for your clinic including total and defaulted plan counts.',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Default rate',
      content: { 'application/json': { schema: defaultRateSchema } },
    },
  },
});

const getTrendsRoute = createRoute({
  method: 'get',
  path: '/stats/trends',
  operationId: 'getEnrollmentTrends',
  tags: ['Clinic'],
  summary: 'Get enrollment trends',
  description: 'Get monthly enrollment counts for trend analysis. Defaults to last 12 months.',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      months: z.coerce.number().int().min(1).max(36).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Enrollment trends',
      content: { 'application/json': { schema: z.array(enrollmentTrendSchema) } },
    },
  },
});

const getClientsRoute = createRoute({
  method: 'get',
  path: '/clients',
  operationId: 'listClients',
  tags: ['Clinic'],
  summary: 'List clients',
  description:
    'List clients with pagination. Supports search by name/email and filtering by plan status.',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      search: z.string().max(100).optional(),
      status: z
        .enum(['pending', 'deposit_paid', 'active', 'completed', 'defaulted', 'cancelled'])
        .optional(),
      page: z.coerce.number().int().min(1).optional(),
      pageSize: z.coerce.number().int().min(1).max(50).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Client list with pagination',
      content: { 'application/json': { schema: clientsResponseSchema } },
    },
  },
});

const getClientDetailsRoute = createRoute({
  method: 'get',
  path: '/clients/{planId}',
  operationId: 'getClientDetails',
  tags: ['Clinic'],
  summary: 'Get client details',
  description: 'Get detailed client information including owner profile and all associated plans.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ planId: z.string().uuid() }),
  },
  responses: {
    200: {
      description: 'Client details',
      content: { 'application/json': { schema: clientDetailsSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

const getPlanDetailsRoute = createRoute({
  method: 'get',
  path: '/plans/{planId}',
  operationId: 'getPlanDetails',
  tags: ['Clinic'],
  summary: 'Get plan details with payments and payouts',
  description: 'Get full plan details including payment schedule and payout history.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ planId: z.string().uuid() }),
  },
  responses: {
    200: {
      description: 'Plan details',
      content: { 'application/json': { schema: planDetailsResponseSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

const getRevenueRoute = createRoute({
  method: 'get',
  path: '/revenue',
  operationId: 'getMonthlyRevenue',
  tags: ['Clinic'],
  summary: 'Get monthly revenue (last 12 months)',
  description:
    'Get monthly revenue breakdown for the last 12 months including payout totals and clinic share.',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Monthly revenue data',
      content: { 'application/json': { schema: z.array(monthlyRevenueSchema) } },
    },
  },
});

const getRevenueReportRoute = createRoute({
  method: 'get',
  path: '/revenue/report',
  operationId: 'getRevenueReport',
  tags: ['Clinic'],
  summary: 'Get revenue report within date range',
  description:
    'Get a revenue report for a custom date range with monthly enrollment and payout aggregates.',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      dateFrom: z.string().datetime(),
      dateTo: z.string().datetime(),
    }),
  },
  responses: {
    200: {
      description: 'Revenue report',
      content: { 'application/json': { schema: z.array(revenueReportSchema) } },
    },
  },
});

const exportClientsRoute = createRoute({
  method: 'get',
  path: '/export/clients',
  operationId: 'exportClientsCsv',
  tags: ['Clinic'],
  summary: 'Export clients as CSV',
  description: 'Export all client data as a CSV string for offline reporting.',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'CSV data',
      content: { 'application/json': { schema: z.object({ csv: z.string() }) } },
    },
  },
});

const exportRevenueRoute = createRoute({
  method: 'get',
  path: '/export/revenue',
  operationId: 'exportRevenueCsv',
  tags: ['Clinic'],
  summary: 'Export revenue as CSV',
  description: 'Export revenue data as a CSV string for a given date range.',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      dateFrom: z.string().datetime(),
      dateTo: z.string().datetime(),
    }),
  },
  responses: {
    200: {
      description: 'CSV data',
      content: { 'application/json': { schema: z.object({ csv: z.string() }) } },
    },
  },
});

const exportPayoutsRoute = createRoute({
  method: 'get',
  path: '/export/payouts',
  operationId: 'exportPayoutsCsv',
  tags: ['Clinic'],
  summary: 'Export payouts as CSV',
  description: 'Export payout history as a CSV string for offline reporting.',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'CSV data',
      content: { 'application/json': { schema: z.object({ csv: z.string() }) } },
    },
  },
});

// ── Route handlers ───────────────────────────────────────────────────

export const clinicRoutes = new OpenAPIHono<{ Variables: ApiVariables }>();

// GET /clinic/profile
clinicRoutes.use('/profile', requirePermission('clinic:read'));
clinicRoutes.openapi(getProfileRoute, async (c) => {
  const profile = await getClinicProfile(c.get('clinicId'));
  if (!profile) {
    throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Clinic profile not found');
  }
  return c.json(profile, 200);
});

// PATCH /clinic/profile
clinicRoutes.use('/profile', requirePermission('clinic:write'));
clinicRoutes.openapi(updateProfileRoute, async (c) => {
  const body = c.req.valid('json');
  const updated = await updateClinicProfile(c.get('clinicId'), body);
  if (!updated) {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, 'No fields to update');
  }
  return c.json(updated, 200);
});

// GET /clinic/stats
clinicRoutes.use('/stats', requirePermission('clinic:read'));
clinicRoutes.openapi(getStatsRoute, async (c) => {
  const stats = await getDashboardStats(c.get('clinicId'));
  return c.json(stats);
});

// GET /clinic/stats/clients
clinicRoutes.use('/stats/clients', requirePermission('clinic:read'));
clinicRoutes.openapi(getClientStatsRoute, async (c) => {
  const stats = await getClientStats(c.get('clinicId'));
  return c.json(stats);
});

// GET /clinic/stats/defaults
clinicRoutes.use('/stats/defaults', requirePermission('clinic:read'));
clinicRoutes.openapi(getDefaultsRoute, async (c) => {
  const rate = await getDefaultRate(c.get('clinicId'));
  return c.json(rate);
});

// GET /clinic/stats/trends
clinicRoutes.use('/stats/trends', requirePermission('clinic:read'));
clinicRoutes.openapi(getTrendsRoute, async (c) => {
  const query = c.req.valid('query');
  const trends = await getEnrollmentTrends(c.get('clinicId'), query.months);
  return c.json(trends);
});

// GET /clinic/clients
clinicRoutes.use('/clients', requirePermission('clients:read'));
clinicRoutes.openapi(getClientsRoute, async (c) => {
  const query = c.req.valid('query');
  const result = await getClients(c.get('clinicId'), {
    search: query.search,
    status: query.status,
    page: query.page,
    pageSize: query.pageSize,
  });
  return c.json(result);
});

// GET /clinic/clients/:planId
clinicRoutes.use('/clients/:planId', requirePermission('clients:read'));
clinicRoutes.openapi(getClientDetailsRoute, async (c) => {
  const { planId } = c.req.valid('param');
  const details = await getClientDetails(c.get('clinicId'), planId);
  if (!details) {
    throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Client not found');
  }
  return c.json(details, 200);
});

// GET /clinic/plans/:planId
clinicRoutes.use('/plans/:planId', requirePermission('clients:read'));
clinicRoutes.openapi(getPlanDetailsRoute, async (c) => {
  const { planId } = c.req.valid('param');
  const details = await getClientPlanDetails(c.get('clinicId'), planId);
  if (!details) {
    throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Plan not found');
  }
  return c.json(details, 200);
});

// GET /clinic/revenue
clinicRoutes.use('/revenue', requirePermission('clinic:read'));
clinicRoutes.openapi(getRevenueRoute, async (c) => {
  const revenue = await getMonthlyRevenue(c.get('clinicId'));
  return c.json(revenue);
});

// GET /clinic/revenue/report
clinicRoutes.use('/revenue/report', requirePermission('clinic:read'));
clinicRoutes.openapi(getRevenueReportRoute, async (c) => {
  const query = c.req.valid('query');
  const report = await getRevenueReport(
    c.get('clinicId'),
    new Date(query.dateFrom),
    new Date(query.dateTo),
  );
  return c.json(report);
});

// GET /clinic/export/clients
clinicRoutes.use('/export/clients', requirePermission('export:read'));
clinicRoutes.openapi(exportClientsRoute, async (c) => {
  const result = await exportClientsCSV(c.get('clinicId'));
  return c.json(result);
});

// GET /clinic/export/revenue
clinicRoutes.use('/export/revenue', requirePermission('export:read'));
clinicRoutes.openapi(exportRevenueRoute, async (c) => {
  const query = c.req.valid('query');
  const result = await exportRevenueCSV(
    c.get('clinicId'),
    new Date(query.dateFrom),
    new Date(query.dateTo),
  );
  return c.json(result);
});

// GET /clinic/export/payouts
clinicRoutes.use('/export/payouts', requirePermission('export:read'));
clinicRoutes.openapi(exportPayoutsRoute, async (c) => {
  const result = await exportPayoutsCSV(c.get('clinicId'));
  return c.json(result);
});
