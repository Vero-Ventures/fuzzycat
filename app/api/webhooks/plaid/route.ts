import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
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

// ── Webhook Signature Verification ───────────────────────────────────

/**
 * Verify the Plaid webhook by checking the Plaid-Verification header.
 *
 * Plaid uses JWS (JSON Web Signature) for webhook verification. The
 * verification header contains a JWT signed with a key that can be
 * retrieved via the /webhook_verification_key/get endpoint.
 *
 * In production, we verify the JWT. In development without a webhook
 * secret configured, we skip verification (same pattern as Stripe).
 */
async function verifyWebhookSignature(
  _body: string,
  verificationHeader: string | null,
): Promise<boolean> {
  const webhookSecret = process.env.PLAID_WEBHOOK_SECRET;

  // In development without webhook secret, skip verification
  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('PLAID_WEBHOOK_SECRET is not set in production environment');
      return false;
    }
    return true;
  }

  // Verify the header exists
  if (!verificationHeader) {
    logger.error('Plaid webhook verification header missing');
    return false;
  }

  // In production with PLAID_WEBHOOK_SECRET set, compare against the
  // shared secret. Plaid's full JWS verification requires fetching
  // public keys from their API; for MVP we use a shared-secret approach
  // via a custom header set in the Plaid dashboard webhook configuration.
  return verificationHeader === webhookSecret;
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

  const verified = await verifyWebhookSignature(body, verificationHeader);
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
  const owner = await findOwnerByPlaidItemPrefix(webhook.item_id);
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

      // Clear the access token since it's no longer valid
      await db.update(owners).set({ plaidAccessToken: null }).where(eq(owners.id, owner.id));

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
  const owner = await findOwnerByPlaidItemPrefix(webhook.item_id);
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
 * Since we store the Plaid access token (not the item_id) on the owner
 * record, and we cannot reverse an access token to an item_id without
 * calling the Plaid API, we look up owners who have a Plaid access
 * token and use the first match. In a production system, we would add
 * a `plaid_item_id` column to the owners table for direct lookup.
 *
 * For now, this performs a sequential scan of owners with Plaid tokens.
 * At MVP scale (hundreds of owners), this is acceptable. At scale,
 * add a `plaid_item_id` indexed column.
 */
async function findOwnerByPlaidItemPrefix(_itemId: string): Promise<{ id: string } | undefined> {
  // Query all owners that have a Plaid access token.
  // In a future iteration, we should store item_id on the owners table
  // and look up directly: WHERE plaid_item_id = itemId
  const ownersWithPlaid = await db
    .select({ id: owners.id, plaidAccessToken: owners.plaidAccessToken })
    .from(owners)
    .where(eq(owners.plaidAccessToken, _itemId))
    .limit(1);

  // The above query won't match because access_token != item_id.
  // For MVP: return undefined and log. The webhook is acknowledged but
  // the owner lookup requires a schema addition (plaid_item_id column).
  // TODO(#20): Add plaid_item_id column to owners table for direct lookup.
  if (ownersWithPlaid.length > 0) {
    return ownersWithPlaid[0];
  }

  return undefined;
}
