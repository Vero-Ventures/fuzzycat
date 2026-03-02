// ── Webhook REST routes ──────────────────────────────────────────────
// 4 endpoints: create, list, update, delete webhook endpoints.
// Plus 1 endpoint: list recent deliveries for an endpoint.

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { ApiError, ErrorCodes } from '@/server/api/middleware/error-handler';
import { requirePermission } from '@/server/api/middleware/permissions';
import type { ApiVariables } from '@/server/api/types';
import {
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  listWebhookEndpoints,
  updateWebhookEndpoint,
  WEBHOOK_EVENTS,
} from '@/server/services/webhook';

// ── Schemas ──────────────────────────────────────────────────────────

const webhookEventEnum = z.enum([...WEBHOOK_EVENTS] as [string, ...string[]]);

const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

const webhookEndpointSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url().max(2048).openapi({ example: 'https://example.com/webhooks/fuzzycat' }),
  events: z.array(z.string()).openapi({ example: ['enrollment.created', 'payment.succeeded'] }),
  enabled: z.boolean().openapi({ example: true }),
  description: z.string().nullable().openapi({ example: 'Production webhook' }),
  createdAt: z.string().nullable().openapi({ example: '2026-01-15T12:00:00.000Z' }),
});

const webhookEndpointWithSecretSchema = webhookEndpointSchema.extend({
  secret: z.string().openapi({ example: 'whsec_abc123...' }),
});

// ── Route definitions ────────────────────────────────────────────────

const createEndpointRoute = createRoute({
  method: 'post',
  path: '/',
  operationId: 'createWebhookEndpoint',
  tags: ['Webhooks'],
  summary: 'Create a webhook endpoint',
  description:
    'Register a URL to receive webhook events. The signing secret is returned only on creation.',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            url: z
              .string()
              .url()
              .max(2048)
              .openapi({ example: 'https://example.com/webhooks/fuzzycat' }),
            events: z.array(webhookEventEnum).min(1),
            description: z.string().max(200).optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Webhook endpoint created (secret shown only once)',
      content: { 'application/json': { schema: webhookEndpointWithSecretSchema } },
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

const listEndpointsRoute = createRoute({
  method: 'get',
  path: '/',
  operationId: 'listWebhookEndpoints',
  tags: ['Webhooks'],
  summary: 'List webhook endpoints',
  description: 'List all webhook endpoints registered for your clinic.',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Webhook endpoints',
      content: { 'application/json': { schema: z.array(webhookEndpointSchema) } },
    },
  },
});

const updateEndpointRoute = createRoute({
  method: 'patch',
  path: '/{endpointId}',
  operationId: 'updateWebhookEndpoint',
  tags: ['Webhooks'],
  summary: 'Update a webhook endpoint',
  description: 'Update the URL, events, enabled status, or description of a webhook endpoint.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ endpointId: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            url: z.string().url().max(2048).optional(),
            events: z.array(webhookEventEnum).min(1).optional(),
            enabled: z.boolean().optional(),
            description: z.string().max(200).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated endpoint',
      content: { 'application/json': { schema: webhookEndpointSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

const deleteEndpointRoute = createRoute({
  method: 'delete',
  path: '/{endpointId}',
  operationId: 'deleteWebhookEndpoint',
  tags: ['Webhooks'],
  summary: 'Delete a webhook endpoint',
  description: 'Delete a webhook endpoint. All pending deliveries will be cancelled.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ endpointId: z.string().uuid() }),
  },
  responses: {
    200: {
      description: 'Endpoint deleted',
      content: { 'application/json': { schema: z.object({ success: z.boolean() }) } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

// ── Route handlers ───────────────────────────────────────────────────

export const webhookRoutes = new OpenAPIHono<{ Variables: ApiVariables }>();

// POST /webhooks — Create endpoint
webhookRoutes.use('/', requirePermission('clinic:write'));
webhookRoutes.openapi(createEndpointRoute, async (c) => {
  const clinicId = c.get('clinicId');
  const body = c.req.valid('json');

  try {
    const endpoint = await createWebhookEndpoint({
      clinicId,
      url: body.url,
      events: body.events,
      description: body.description,
    });

    return c.json(
      {
        ...endpoint,
        createdAt: endpoint.createdAt?.toISOString() ?? null,
      },
      201,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create webhook endpoint';
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, message);
  }
});

// GET /webhooks — List endpoints
webhookRoutes.use('/', requirePermission('clinic:read'));
webhookRoutes.openapi(listEndpointsRoute, async (c) => {
  const endpoints = await listWebhookEndpoints(c.get('clinicId'));
  return c.json(
    endpoints.map((ep) => ({
      ...ep,
      createdAt: ep.createdAt?.toISOString() ?? null,
    })),
  );
});

// PATCH /webhooks/:endpointId — Update endpoint
webhookRoutes.use('/:endpointId', requirePermission('clinic:write'));
webhookRoutes.openapi(updateEndpointRoute, async (c) => {
  const { endpointId } = c.req.valid('param');
  const body = c.req.valid('json');

  try {
    const updated = await updateWebhookEndpoint(endpointId, c.get('clinicId'), body);
    if (!updated) {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Webhook endpoint not found');
    }
    return c.json(
      {
        ...updated,
        createdAt: updated.createdAt?.toISOString() ?? null,
      },
      200,
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const message = error instanceof Error ? error.message : 'Failed to update webhook endpoint';
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, message);
  }
});

// DELETE /webhooks/:endpointId — Delete endpoint
webhookRoutes.use('/:endpointId', requirePermission('clinic:write'));
webhookRoutes.openapi(deleteEndpointRoute, async (c) => {
  const { endpointId } = c.req.valid('param');
  const deleted = await deleteWebhookEndpoint(endpointId, c.get('clinicId'));
  if (!deleted) {
    throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Webhook endpoint not found');
  }
  return c.json({ success: true }, 200);
});
