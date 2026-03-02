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

// ── Route definitions ────────────────────────────────────────────────

const getProfileRoute = createRoute({
  method: 'get',
  path: '/profile',
  tags: ['Clinic'],
  summary: 'Get clinic profile',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Clinic profile',
      content: { 'application/json': { schema: z.object({}).passthrough() } },
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
  tags: ['Clinic'],
  summary: 'Update clinic profile',
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
      content: { 'application/json': { schema: z.object({}).passthrough() } },
    },
    400: {
      description: 'Bad request',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

const getStatsRoute = createRoute({
  method: 'get',
  path: '/stats',
  tags: ['Clinic'],
  summary: 'Get dashboard statistics',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Dashboard stats',
      content: { 'application/json': { schema: z.object({}).passthrough() } },
    },
  },
});

const getClientStatsRoute = createRoute({
  method: 'get',
  path: '/stats/clients',
  tags: ['Clinic'],
  summary: 'Get client statistics',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Client stats',
      content: { 'application/json': { schema: z.object({}).passthrough() } },
    },
  },
});

const getDefaultsRoute = createRoute({
  method: 'get',
  path: '/stats/defaults',
  tags: ['Clinic'],
  summary: 'Get default rate',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Default rate',
      content: { 'application/json': { schema: z.object({}).passthrough() } },
    },
  },
});

const getTrendsRoute = createRoute({
  method: 'get',
  path: '/stats/trends',
  tags: ['Clinic'],
  summary: 'Get enrollment trends',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      months: z.coerce.number().int().min(1).max(36).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Enrollment trends',
      content: { 'application/json': { schema: z.array(z.object({}).passthrough()) } },
    },
  },
});

const getClientsRoute = createRoute({
  method: 'get',
  path: '/clients',
  tags: ['Clinic'],
  summary: 'List clients',
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
      content: { 'application/json': { schema: z.object({}).passthrough() } },
    },
  },
});

const getClientDetailsRoute = createRoute({
  method: 'get',
  path: '/clients/{planId}',
  tags: ['Clinic'],
  summary: 'Get client details',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ planId: z.string().uuid() }),
  },
  responses: {
    200: {
      description: 'Client details',
      content: { 'application/json': { schema: z.object({}).passthrough() } },
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
  tags: ['Clinic'],
  summary: 'Get plan details with payments and payouts',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ planId: z.string().uuid() }),
  },
  responses: {
    200: {
      description: 'Plan details',
      content: { 'application/json': { schema: z.object({}).passthrough() } },
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
  tags: ['Clinic'],
  summary: 'Get monthly revenue (last 12 months)',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Monthly revenue data',
      content: { 'application/json': { schema: z.array(z.object({}).passthrough()) } },
    },
  },
});

const getRevenueReportRoute = createRoute({
  method: 'get',
  path: '/revenue/report',
  tags: ['Clinic'],
  summary: 'Get revenue report within date range',
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
      content: { 'application/json': { schema: z.array(z.object({}).passthrough()) } },
    },
  },
});

const exportClientsRoute = createRoute({
  method: 'get',
  path: '/export/clients',
  tags: ['Clinic'],
  summary: 'Export clients as CSV',
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
  tags: ['Clinic'],
  summary: 'Export revenue as CSV',
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
  tags: ['Clinic'],
  summary: 'Export payouts as CSV',
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
