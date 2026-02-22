import { eq } from 'drizzle-orm';
import { decodeProtectedHeader, importJWK, jwtVerify } from 'jose';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { plaid } from '@/lib/plaid';
import { db } from '@/server/db';
import { owners } from '@/server/db/schema';
import { logAuditEvent } from '@/server/services/audit';

// ── Plaid Webhook Types ──────────────────────────────────────────────

interface PlaidWebhookBase {
  webhook_type: string;
  webhook_code: string;
  item_id: string;
  environment: string;
}

interface PlaidWebhookError {
  error_type: string;
  error_code: string;
  error_message: string;
}

interface PlaidItemWebhook extends PlaidWebhookBase {
  webhook_type: 'ITEM';
  webhook_code: 'ERROR' | 'PENDING_EXPIRATION' | 'USER_PERMISSION_REVOKED';
  error?: PlaidWebhookError;
}

interface PlaidAuthWebhook extends PlaidWebhookBase {
  webhook_type: 'AUTH';
  webhook_code: 'AUTOMATICALLY_VERIFIED' | 'VERIFICATION_EXPIRED' | 'DEFAULT_UPDATE';
  account_id?: string;
}

type PlaidWebhook = PlaidItemWebhook | PlaidAuthWebhook | PlaidWebhookBase;

// ── Webhook Verification ─────────────────────────────────────────────

/**
 * Verify the Plaid webhook using full JWS signature verification.
 *
 * 1. Decode the JWT header to extract the `kid` (key ID)
 * 2. Fetch the corresponding public key from Plaid via `webhookVerificationKeyGet`
 * 3. Verify the JWT signature using `jose`
 * 4. Validate the body SHA-256 hash from the verified payload
 */
async function verifyWebhook(body: string, verificationHeader: string | null): Promise<boolean> {
  if (!verificationHeader) {
    logger.error('Plaid webhook: Plaid-Verification header missing');
    return false;
  }

  try {
    // 1. Decode the JWT header to get the key ID
    const { kid } = decodeProtectedHeader(verificationHeader);

    if (!kid) {
      logger.error('Plaid webhook: JWS header missing kid');
      return false;
    }

    // 2. Fetch the public key from Plaid
    const keyResponse = await plaid().webhookVerificationKeyGet({ key_id: kid });
    const jwk = keyResponse.data.key;

    // 3. Import the JWK and verify the JWT signature
    const publicKey = await importJWK(jwk);
    const { payload } = await jwtVerify(verificationHeader, publicKey, {
      clockTolerance: 300,
    });

    const claimedHash = (payload as { request_body_sha256?: string }).request_body_sha256;
    if (!claimedHash) {
      logger.error('Plaid webhook: verified payload missing request_body_sha256');
      return false;
    }

    // 4. Verify the body hash
    const encoder = new TextEncoder();
    const data = encoder.encode(body);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    const hashHex = Array.from(hashArray)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (hashHex !== claimedHash) {
      logger.error('Plaid webhook: body hash mismatch');
      return false;
    }

    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Plaid webhook: verification failed', { error: message });
    return false;
  }
}

// ── Webhook Route Handler ────────────────────────────────────────────

/**
 * Plaid webhook handler.
 *
 * Verifies the webhook, then routes to the appropriate handler based on
 * the webhook_type and webhook_code. Account status changes are logged
 * to the audit_log table for compliance.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const verificationHeader = request.headers.get('plaid-verification');

  const verified = await verifyWebhook(body, verificationHeader);
  if (!verified) {
    return NextResponse.json({ error: 'Webhook verification failed' }, { status: 400 });
  }

  let webhook: PlaidWebhook;
  try {
    webhook = JSON.parse(body) as PlaidWebhook;
  } catch {
    logger.error('Plaid webhook: invalid JSON body');
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { webhook_type, webhook_code, item_id } = webhook;

  logger.info('Plaid webhook received', { webhook_type, webhook_code, item_id });

  try {
    switch (webhook_type) {
      case 'ITEM':
        await handleItemWebhook(webhook as PlaidItemWebhook);
        break;

      case 'AUTH':
        await handleAuthWebhook(webhook as PlaidAuthWebhook);
        break;

      default:
        // Unhandled webhook type -- log but don't fail
        logger.info('Plaid webhook: unhandled type', { webhook_type, webhook_code });
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Plaid webhook handler error', { webhook_type, webhook_code, error: message });
    return NextResponse.json({ error: 'Webhook handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ── Webhook Handlers ─────────────────────────────────────────────────

/**
 * Handle ITEM webhook events (errors, expiration, revocation).
 * These indicate changes to the bank connection itself.
 */
async function handleItemWebhook(webhook: PlaidItemWebhook): Promise<void> {
  const owner = await findOwnerByItemId(webhook.item_id);
  if (!owner) {
    logger.warn('Plaid ITEM webhook: no owner found for item', { itemId: webhook.item_id });
    return;
  }

  switch (webhook.webhook_code) {
    case 'ERROR': {
      logger.error('Plaid ITEM error', {
        ownerId: owner.id,
        itemId: webhook.item_id,
        errorCode: webhook.error?.error_code,
        errorMessage: webhook.error?.error_message,
      });

      await logAuditEvent({
        entityType: 'owner',
        entityId: owner.id,
        action: 'status_changed',
        oldValue: { bankStatus: 'connected' },
        newValue: {
          bankStatus: 'error',
          errorCode: webhook.error?.error_code,
          errorMessage: webhook.error?.error_message,
        },
        actorType: 'system',
      });
      break;
    }

    case 'PENDING_EXPIRATION': {
      logger.warn('Plaid ITEM pending expiration', {
        ownerId: owner.id,
        itemId: webhook.item_id,
      });

      await logAuditEvent({
        entityType: 'owner',
        entityId: owner.id,
        action: 'status_changed',
        oldValue: { bankStatus: 'connected' },
        newValue: { bankStatus: 'pending_expiration' },
        actorType: 'system',
      });
      break;
    }

    case 'USER_PERMISSION_REVOKED': {
      logger.warn('Plaid ITEM user permission revoked', {
        ownerId: owner.id,
        itemId: webhook.item_id,
      });

      // Clear the access token and item ID since they're no longer valid
      await db
        .update(owners)
        .set({ plaidAccessToken: null, plaidItemId: null })
        .where(eq(owners.id, owner.id));

      await logAuditEvent({
        entityType: 'owner',
        entityId: owner.id,
        action: 'status_changed',
        oldValue: { bankStatus: 'connected' },
        newValue: { bankStatus: 'revoked' },
        actorType: 'system',
      });
      break;
    }
  }
}

/**
 * Handle AUTH webhook events (verification status changes).
 */
async function handleAuthWebhook(webhook: PlaidAuthWebhook): Promise<void> {
  const owner = await findOwnerByItemId(webhook.item_id);
  if (!owner) {
    logger.warn('Plaid AUTH webhook: no owner found for item', { itemId: webhook.item_id });
    return;
  }

  switch (webhook.webhook_code) {
    case 'AUTOMATICALLY_VERIFIED': {
      logger.info('Plaid AUTH automatically verified', {
        ownerId: owner.id,
        itemId: webhook.item_id,
      });

      await logAuditEvent({
        entityType: 'owner',
        entityId: owner.id,
        action: 'status_changed',
        oldValue: { authStatus: 'pending' },
        newValue: { authStatus: 'verified' },
        actorType: 'system',
      });
      break;
    }

    case 'VERIFICATION_EXPIRED': {
      logger.warn('Plaid AUTH verification expired', {
        ownerId: owner.id,
        itemId: webhook.item_id,
      });

      await logAuditEvent({
        entityType: 'owner',
        entityId: owner.id,
        action: 'status_changed',
        oldValue: { authStatus: 'verified' },
        newValue: { authStatus: 'expired' },
        actorType: 'system',
      });
      break;
    }

    default:
      logger.info('Plaid AUTH webhook: unhandled code', { webhookCode: webhook.webhook_code });
      break;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Find the owner associated with a Plaid item_id.
 *
 * Looks up the owner by the `plaid_item_id` column, which is stored
 * during the public token exchange in `exchangePublicToken`.
 */
async function findOwnerByItemId(itemId: string): Promise<{ id: string } | undefined> {
  const [owner] = await db
    .select({ id: owners.id })
    .from(owners)
    .where(eq(owners.plaidItemId, itemId))
    .limit(1);

  return owner;
}
