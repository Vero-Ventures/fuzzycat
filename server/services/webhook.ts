// ── Webhook service ─────────────────────────────────────────────────
// Manages webhook endpoints and dispatches events to clinic-registered URLs.
// Uses HMAC-SHA256 signatures for payload verification.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { resolve4, resolve6 } from 'node:dns/promises';
import { isIP } from 'node:net';
import { and, eq, lte } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { db } from '@/server/db';
import { webhookDeliveries, webhookEndpoints } from '@/server/db/schema';

// ── SSRF Protection ──────────────────────────────────────────────────

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal']);

/**
 * Check if an IP address is private/reserved (SSRF risk).
 */
function isPrivateIp(ip: string): boolean {
  // IPv4 loopback
  if (ip.startsWith('127.')) return true;
  // IPv4 private ranges
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  // Link-local (AWS metadata endpoint 169.254.169.254)
  if (ip.startsWith('169.254.')) return true;
  // IPv6 loopback
  if (ip === '::1') return true;
  // IPv6 private
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
  // IPv6 link-local
  if (ip.startsWith('fe80:')) return true;
  return false;
}

/**
 * Validate a webhook URL is safe to call (no SSRF).
 * Resolves hostname to IP and rejects private/reserved ranges.
 */
async function validateWebhookUrl(urlString: string): Promise<void> {
  const url = new URL(urlString);
  if (url.protocol !== 'https:') {
    throw new Error('Webhook URL must use HTTPS');
  }
  if (url.hostname.length > 253) {
    throw new Error('Webhook URL hostname too long');
  }
  if (BLOCKED_HOSTNAMES.has(url.hostname.toLowerCase())) {
    throw new Error('Webhook URL hostname is not allowed');
  }
  // If hostname is already an IP, check directly
  if (isIP(url.hostname)) {
    if (isPrivateIp(url.hostname)) {
      throw new Error('Webhook URL must not target private/internal networks');
    }
    return;
  }
  // Resolve ALL DNS records and check every IP (prevents DNS rebinding)
  try {
    const [ipv4s, ipv6s] = await Promise.all([
      resolve4(url.hostname).catch(() => [] as string[]),
      resolve6(url.hostname).catch(() => [] as string[]),
    ]);
    const allIps = [...ipv4s, ...ipv6s];
    if (allIps.length === 0) {
      throw new Error('Webhook URL hostname could not be resolved');
    }
    for (const ip of allIps) {
      if (isPrivateIp(ip)) {
        throw new Error('Webhook URL must not target private/internal networks');
      }
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('private') || error.message.includes('resolved'))
    ) {
      throw error;
    }
    throw new Error('Webhook URL hostname could not be resolved');
  }
}

// ── Types ─────────────────────────────────────────────────────────────

export const WEBHOOK_EVENTS = [
  'enrollment.created',
  'enrollment.cancelled',
  'payment.succeeded',
  'payment.failed',
  'plan.defaulted',
  'plan.completed',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface WebhookPayload {
  id: string;
  event: WebhookEvent;
  clinicId: string;
  createdAt: string;
  data: Record<string, unknown>;
}

interface CreateEndpointParams {
  clinicId: string;
  url: string;
  events: string[];
  description?: string;
}

interface EndpointInfo {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  description: string | null;
  secret: string;
  createdAt: Date | null;
}

// ── HMAC Signing ──────────────────────────────────────────────────────

/**
 * Generate HMAC-SHA256 signature for a webhook payload.
 * Signature format: `sha256=<hex>`
 */
export function signPayload(payload: string, secret: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Verify HMAC-SHA256 signature.
 * Uses crypto.timingSafeEqual for constant-time comparison.
 */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = signPayload(payload, secret);
  const expectedBuf = Buffer.from(expected, 'utf-8');
  const signatureBuf = Buffer.from(signature, 'utf-8');
  if (expectedBuf.length !== signatureBuf.length) return false;
  return timingSafeEqual(expectedBuf, signatureBuf);
}

// ── Endpoint Management ───────────────────────────────────────────────

/**
 * Create a webhook endpoint for a clinic.
 * Generates a random HMAC signing secret.
 */
export async function createWebhookEndpoint(
  params: CreateEndpointParams,
): Promise<EndpointInfo & { secret: string }> {
  // Validate events
  const invalidEvents = params.events.filter((e) => !WEBHOOK_EVENTS.includes(e as WebhookEvent));
  if (invalidEvents.length > 0) {
    throw new Error(`Invalid webhook events: ${invalidEvents.join(', ')}`);
  }

  // Validate URL (HTTPS + SSRF protection)
  try {
    await validateWebhookUrl(params.url);
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Invalid webhook URL');
  }

  const secret = `whsec_${randomBytes(24).toString('hex')}`;

  const [endpoint] = await db
    .insert(webhookEndpoints)
    .values({
      clinicId: params.clinicId,
      url: params.url,
      events: params.events,
      secret,
      description: params.description,
    })
    .returning();

  return {
    id: endpoint.id,
    url: endpoint.url,
    events: endpoint.events,
    enabled: endpoint.enabled,
    description: endpoint.description,
    secret,
    createdAt: endpoint.createdAt,
  };
}

/**
 * List all webhook endpoints for a clinic.
 * Does NOT return the secret (shown only on creation).
 */
export async function listWebhookEndpoints(clinicId: string) {
  return db
    .select({
      id: webhookEndpoints.id,
      url: webhookEndpoints.url,
      events: webhookEndpoints.events,
      enabled: webhookEndpoints.enabled,
      description: webhookEndpoints.description,
      createdAt: webhookEndpoints.createdAt,
    })
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.clinicId, clinicId));
}

/**
 * Update a webhook endpoint.
 */
export async function updateWebhookEndpoint(
  endpointId: string,
  clinicId: string,
  updates: { url?: string; events?: string[]; enabled?: boolean; description?: string },
) {
  if (updates.events) {
    const invalidEvents = updates.events.filter((e) => !WEBHOOK_EVENTS.includes(e as WebhookEvent));
    if (invalidEvents.length > 0) {
      throw new Error(`Invalid webhook events: ${invalidEvents.join(', ')}`);
    }
  }

  if (updates.url) {
    try {
      await validateWebhookUrl(updates.url);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Invalid webhook URL');
    }
  }

  const [updated] = await db
    .update(webhookEndpoints)
    .set(updates)
    .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.clinicId, clinicId)))
    .returning({
      id: webhookEndpoints.id,
      url: webhookEndpoints.url,
      events: webhookEndpoints.events,
      enabled: webhookEndpoints.enabled,
      description: webhookEndpoints.description,
      createdAt: webhookEndpoints.createdAt,
    });

  return updated ?? null;
}

/**
 * Delete a webhook endpoint and all its delivery records.
 */
export async function deleteWebhookEndpoint(endpointId: string, clinicId: string) {
  const [deleted] = await db
    .delete(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.clinicId, clinicId)))
    .returning({ id: webhookEndpoints.id });

  return !!deleted;
}

// ── Event Dispatching ─────────────────────────────────────────────────

const MAX_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [0, 60_000, 300_000, 900_000, 3_600_000]; // 0, 1m, 5m, 15m, 1h

/**
 * Dispatch an event to all matching webhook endpoints for a clinic.
 * Creates delivery records and attempts immediate delivery.
 */
export async function dispatchWebhookEvent(
  clinicId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
) {
  // Find all enabled endpoints for this clinic that subscribe to this event
  const endpoints = await db
    .select()
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.clinicId, clinicId), eq(webhookEndpoints.enabled, true)));

  const matchingEndpoints = endpoints.filter((ep) => ep.events.includes(event));

  if (matchingEndpoints.length === 0) return;

  const eventId = crypto.randomUUID();
  const payload: WebhookPayload = {
    id: eventId,
    event,
    clinicId,
    createdAt: new Date().toISOString(),
    data,
  };

  for (const endpoint of matchingEndpoints) {
    // Create delivery record
    const [delivery] = await db
      .insert(webhookDeliveries)
      .values({
        endpointId: endpoint.id,
        eventType: event,
        payload,
        status: 'pending',
        attempts: 0,
      })
      .returning();

    // Attempt immediate delivery (fire-and-forget)
    deliverWebhook(delivery.id, endpoint.url, endpoint.secret, payload, 1).catch((err) => {
      logger.error('Webhook delivery failed', {
        deliveryId: delivery.id,
        endpointId: endpoint.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }
}

const MAX_RESPONSE_BODY_BYTES = 8192; // 8 KB max response body read

/**
 * Read response body with a size limit to prevent DoS from large responses.
 */
async function readResponseBody(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (totalBytes < MAX_RESPONSE_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalBytes += value.length;
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  const decoder = new TextDecoder();
  return chunks.map((c) => decoder.decode(c, { stream: true })).join('');
}

/**
 * Attempt to deliver a webhook payload to a URL.
 * Updates the delivery record with the result.
 */
async function deliverWebhook(
  deliveryId: string,
  url: string,
  secret: string,
  payload: WebhookPayload,
  attemptNumber: number,
) {
  // Re-validate URL at delivery time (prevents DNS rebinding TOCTOU)
  try {
    await validateWebhookUrl(url);
  } catch {
    await scheduleRetry(
      deliveryId,
      attemptNumber,
      null,
      'URL failed SSRF validation at delivery time',
    );
    return;
  }

  const body = JSON.stringify(payload);
  const signature = signPayload(body, secret);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': timestamp,
        'X-Webhook-Id': payload.id,
        'User-Agent': 'FuzzyCat-Webhooks/1.0',
      },
      body,
      signal: AbortSignal.timeout(10_000), // 10s timeout
    });

    const responseBody = await readResponseBody(response).catch(() => '');

    if (response.ok) {
      await db
        .update(webhookDeliveries)
        .set({
          status: 'succeeded',
          httpStatus: response.status,
          responseBody: responseBody.slice(0, 1000),
          attempts: attemptNumber,
          completedAt: new Date(),
        })
        .where(eq(webhookDeliveries.id, deliveryId));
    } else {
      await scheduleRetry(deliveryId, attemptNumber, response.status, responseBody.slice(0, 1000));
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await scheduleRetry(deliveryId, attemptNumber, null, errorMessage);
  }
}

/**
 * Schedule a retry for a failed delivery.
 */
async function scheduleRetry(
  deliveryId: string,
  attemptNumber: number,
  httpStatus: number | null,
  responseBody: string,
) {
  if (attemptNumber >= MAX_ATTEMPTS) {
    await db
      .update(webhookDeliveries)
      .set({
        status: 'failed',
        httpStatus,
        responseBody,
        attempts: attemptNumber,
        completedAt: new Date(),
      })
      .where(eq(webhookDeliveries.id, deliveryId));
    return;
  }

  const nextRetry = new Date(Date.now() + RETRY_DELAYS_MS[attemptNumber]);

  await db
    .update(webhookDeliveries)
    .set({
      httpStatus,
      responseBody,
      attempts: attemptNumber,
      nextRetryAt: nextRetry,
    })
    .where(eq(webhookDeliveries.id, deliveryId));
}

/**
 * Process pending webhook retries.
 * Called by a background cron job.
 */
export async function processWebhookRetries() {
  const pendingDeliveries = await db
    .select({
      id: webhookDeliveries.id,
      endpointId: webhookDeliveries.endpointId,
      payload: webhookDeliveries.payload,
      attempts: webhookDeliveries.attempts,
    })
    .from(webhookDeliveries)
    .where(
      and(eq(webhookDeliveries.status, 'pending'), lte(webhookDeliveries.nextRetryAt, new Date())),
    )
    .limit(50);

  for (const delivery of pendingDeliveries) {
    if (!delivery.payload || typeof delivery.payload !== 'object') continue;

    // Fetch the endpoint details
    const [endpoint] = await db
      .select({ url: webhookEndpoints.url, secret: webhookEndpoints.secret })
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, delivery.endpointId))
      .limit(1);

    if (!endpoint) {
      // Endpoint was deleted — mark as failed
      await db
        .update(webhookDeliveries)
        .set({ status: 'failed', completedAt: new Date() })
        .where(eq(webhookDeliveries.id, delivery.id));
      continue;
    }

    await deliverWebhook(
      delivery.id,
      endpoint.url,
      endpoint.secret,
      delivery.payload as WebhookPayload,
      delivery.attempts + 1,
    ).catch((err) => {
      logger.error('Webhook retry failed', {
        deliveryId: delivery.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }
}
