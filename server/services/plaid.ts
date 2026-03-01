// ── Plaid service: bank verification & balance check ─────────────────
// Server-side functions for Plaid Link token creation, public token
// exchange, and balance verification. Never stores bank account numbers
// or routing numbers — only Plaid access tokens.

import { eq } from 'drizzle-orm';
import { CountryCode, Products } from 'plaid';
import { logger } from '@/lib/logger';
import { plaid } from '@/lib/plaid';
import { stripe } from '@/lib/stripe';
import { db } from '@/server/db';
import { owners } from '@/server/db/schema';
import { logAuditEvent } from '@/server/services/audit';

// ── Types ─────────────────────────────────────────────────────────────

export interface BalanceCheckResult {
  approved: boolean;
  availableBalanceCents: number;
  requiredCents: number;
  reason: string;
}

// ── Service functions ─────────────────────────────────────────────────

/**
 * Create a Plaid Link token for the enrollment flow.
 *
 * The Link token is used by the Plaid Link frontend component to
 * initiate the bank connection flow. It is short-lived (30 minutes).
 *
 * @param userId - Unique identifier for the user (used as Plaid client_user_id)
 */
export async function createLinkToken(userId: string): Promise<string> {
  const response = await plaid().linkTokenCreate({
    user: { client_user_id: userId },
    client_name: 'FuzzyCat',
    products: [Products.Auth],
    country_codes: [CountryCode.Us],
    language: 'en',
  });

  return response.data.link_token;
}

/**
 * Exchange a Plaid public token for a permanent access token, create a
 * Stripe ACH payment method via Plaid's processor token API, and store
 * everything on the owner record.
 *
 * The public token is a short-lived token returned by Plaid Link after
 * the user successfully connects their bank. The access token is
 * permanent and used for subsequent API calls (balance checks, etc.).
 *
 * @param publicToken - Short-lived token from Plaid Link
 * @param ownerId - UUID of the pet owner
 * @param accountId - Plaid account ID selected by the user
 */
export async function exchangePublicToken(
  publicToken: string,
  ownerId: string,
  accountId: string,
): Promise<{ accessToken: string; itemId: string; stripeAchPaymentMethodId: string }> {
  const response = await plaid().itemPublicTokenExchange({
    public_token: publicToken,
  });

  const accessToken = response.data.access_token;
  const itemId = response.data.item_id;

  // Create a Stripe bank account token via Plaid processor
  const processorResponse = await plaid().processorStripeBankAccountTokenCreate({
    access_token: accessToken,
    account_id: accountId,
  });

  const stripeBankAccountToken = processorResponse.data.stripe_bank_account_token;

  // Look up the owner's Stripe customer ID
  const [owner] = await db
    .select({ stripeCustomerId: owners.stripeCustomerId })
    .from(owners)
    .where(eq(owners.id, ownerId))
    .limit(1);

  if (!owner?.stripeCustomerId) {
    throw new Error(`Owner ${ownerId} does not have a Stripe customer ID`);
  }

  // Create a bank account source on the Stripe customer
  const source = await stripe().customers.createSource(owner.stripeCustomerId, {
    source: stripeBankAccountToken,
  });

  const stripeAchPaymentMethodId = source.id;

  // Store access token, item ID, account ID, and Stripe ACH payment method on owner record
  await db
    .update(owners)
    .set({
      plaidAccessToken: accessToken,
      plaidItemId: itemId,
      plaidAccountId: accountId,
      stripeAchPaymentMethodId,
    })
    .where(eq(owners.id, ownerId));

  await logAuditEvent({
    entityType: 'owner',
    entityId: ownerId,
    action: 'status_changed',
    oldValue: null,
    newValue: { plaidItemId: itemId, stripeAchPaymentMethodId, bankConnected: true },
    actorType: 'owner',
    actorId: ownerId,
  });

  logger.info('Plaid public token exchanged and Stripe ACH payment method created', {
    ownerId,
    itemId,
    stripeAchPaymentMethodId,
  });

  return { accessToken, itemId, stripeAchPaymentMethodId };
}

/**
 * Check if the owner's bank account has sufficient balance to cover the
 * required amount (deposit + first 2 installments).
 *
 * Uses the Plaid Balance API to fetch real-time account balances. Returns
 * an approval/decline decision with a human-readable reason.
 *
 * @param ownerId - UUID of the pet owner (must have plaidAccessToken set)
 * @param requiredCents - Minimum balance required in integer cents
 */
export async function checkBalance(
  ownerId: string,
  requiredCents: number,
): Promise<BalanceCheckResult> {
  // Look up the owner's Plaid access token
  const [owner] = await db
    .select({ plaidAccessToken: owners.plaidAccessToken })
    .from(owners)
    .where(eq(owners.id, ownerId))
    .limit(1);

  if (!owner) {
    throw new Error(`Owner not found: ${ownerId}`);
  }

  if (!owner.plaidAccessToken) {
    throw new Error(`Owner ${ownerId} does not have a connected bank account`);
  }

  const response = await plaid().accountsBalanceGet({
    access_token: owner.plaidAccessToken,
  });

  const accounts = response.data.accounts;

  if (accounts.length === 0) {
    return {
      approved: false,
      availableBalanceCents: 0,
      requiredCents,
      reason: 'No bank accounts found',
    };
  }

  // Find the account with the highest available balance.
  // Plaid returns balances in dollars (float), convert to integer cents.
  let maxAvailableCents = 0;
  for (const account of accounts) {
    const available = account.balances.available ?? account.balances.current ?? 0;
    const availableCents = Math.round(available * 100);
    if (availableCents > maxAvailableCents) {
      maxAvailableCents = availableCents;
    }
  }

  const approved = maxAvailableCents >= requiredCents;

  const result: BalanceCheckResult = {
    approved,
    availableBalanceCents: maxAvailableCents,
    requiredCents,
    reason: approved
      ? 'Sufficient balance available'
      : 'Insufficient balance: available balance does not cover deposit and first 2 installments',
  };

  await logAuditEvent({
    entityType: 'owner',
    entityId: ownerId,
    action: 'status_changed',
    oldValue: null,
    newValue: {
      balanceCheck: result.approved ? 'approved' : 'declined',
      availableBalanceCents: maxAvailableCents,
      requiredCents,
    },
    actorType: 'system',
  });

  logger.info('Balance check completed', {
    ownerId,
    approved,
    availableBalanceCents: maxAvailableCents,
    requiredCents,
  });

  return result;
}
