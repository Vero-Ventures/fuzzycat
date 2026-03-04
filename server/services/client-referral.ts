import { randomBytes } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { CLIENT_REFERRAL_CREDIT_CENTS, CLIENT_REFERRAL_DISCOUNT_CENTS } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { db } from '@/server/db';
import { clientReferrals } from '@/server/db/schema';

// ── Types ────────────────────────────────────────────────────────────

export interface ClientReferralRow {
  id: string;
  referralCode: string;
  status: 'pending' | 'converted' | 'expired';
  creditApplied: boolean;
  convertedAt: Date | null;
  createdAt: Date | null;
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Generate a unique referral code for a client.
 * Format: FC-CLIENT-XXXX (4 random hex chars)
 */
export function generateClientReferralCode(): string {
  const hex = randomBytes(3).toString('hex').toUpperCase();
  return `FC-CLIENT-${hex}`;
}

// ── Queries ──────────────────────────────────────────────────────────

/**
 * Get or create a client's referral code.
 */
export async function getOrCreateClientReferralCode(
  clientId: string,
): Promise<{ code: string; shareUrl: string; discountAmount: number; creditAmount: number }> {
  // Check if owner already has a referral entry
  const [existing] = await db
    .select({ referralCode: clientReferrals.referralCode })
    .from(clientReferrals)
    .where(eq(clientReferrals.referrerClientId, clientId))
    .limit(1);

  if (existing) {
    return {
      code: existing.referralCode,
      shareUrl: `https://www.fuzzycatapp.com/signup/client?ref=${encodeURIComponent(existing.referralCode)}`,
      discountAmount: CLIENT_REFERRAL_DISCOUNT_CENTS,
      creditAmount: CLIENT_REFERRAL_CREDIT_CENTS,
    };
  }

  // Create a new referral code
  const code = generateClientReferralCode();
  await db.insert(clientReferrals).values({
    referrerClientId: clientId,
    referralCode: code,
  });

  return {
    code,
    shareUrl: `https://www.fuzzycatapp.com/signup/client?ref=${encodeURIComponent(code)}`,
    discountAmount: CLIENT_REFERRAL_DISCOUNT_CENTS,
    creditAmount: CLIENT_REFERRAL_CREDIT_CENTS,
  };
}

/**
 * Get all referrals created by a client.
 */
export async function getClientReferrals(clientId: string): Promise<ClientReferralRow[]> {
  return db
    .select({
      id: clientReferrals.id,
      referralCode: clientReferrals.referralCode,
      status: clientReferrals.status,
      creditApplied: clientReferrals.creditApplied,
      convertedAt: clientReferrals.convertedAt,
      createdAt: clientReferrals.createdAt,
    })
    .from(clientReferrals)
    .where(eq(clientReferrals.referrerClientId, clientId))
    .orderBy(desc(clientReferrals.createdAt));
}

// ── Mutations ────────────────────────────────────────────────────────

/**
 * Convert a client referral when a referred client signs up.
 */
export async function convertClientReferral(
  referralCode: string,
  referredClientId: string,
): Promise<{ success: boolean; referrerId?: string }> {
  return await db.transaction(async (tx) => {
    const [referral] = await tx
      .select({
        id: clientReferrals.id,
        referrerClientId: clientReferrals.referrerClientId,
        status: clientReferrals.status,
      })
      .from(clientReferrals)
      .where(
        and(eq(clientReferrals.referralCode, referralCode), eq(clientReferrals.status, 'pending')),
      )
      .limit(1);

    if (!referral) {
      return { success: false };
    }

    await tx
      .update(clientReferrals)
      .set({
        referredClientId,
        status: 'converted',
        convertedAt: new Date(),
      })
      .where(eq(clientReferrals.id, referral.id));

    logger.info('Client referral converted', {
      referralId: referral.id,
      referrerClientId: referral.referrerClientId,
      referredClientId,
    });

    return { success: true, referrerId: referral.referrerClientId };
  });
}

/**
 * Get the fee discount for a referred client's enrollment.
 * Returns 0 if the owner was not referred.
 */
export async function getReferralDiscount(
  clientId: string,
  queryDb: Pick<typeof db, 'select'> = db,
): Promise<number> {
  const [referral] = await queryDb
    .select({ id: clientReferrals.id })
    .from(clientReferrals)
    .where(
      and(eq(clientReferrals.referredClientId, clientId), eq(clientReferrals.status, 'converted')),
    )
    .limit(1);

  return referral ? CLIENT_REFERRAL_DISCOUNT_CENTS : 0;
}
