import { randomBytes } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { OWNER_REFERRAL_CREDIT_CENTS, OWNER_REFERRAL_DISCOUNT_CENTS } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { db } from '@/server/db';
import { ownerReferrals } from '@/server/db/schema';

// ── Types ────────────────────────────────────────────────────────────

export interface OwnerReferralRow {
  id: string;
  referralCode: string;
  status: 'pending' | 'converted' | 'expired';
  creditApplied: boolean;
  convertedAt: Date | null;
  createdAt: Date | null;
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Generate a unique referral code for a pet owner.
 * Format: FC-OWNER-XXXX (4 random hex chars)
 */
export function generateOwnerReferralCode(): string {
  const hex = randomBytes(3).toString('hex').toUpperCase();
  return `FC-OWNER-${hex}`;
}

// ── Queries ──────────────────────────────────────────────────────────

/**
 * Get or create a pet owner's referral code.
 */
export async function getOrCreateOwnerReferralCode(
  ownerId: string,
): Promise<{ code: string; shareUrl: string; discountAmount: number; creditAmount: number }> {
  // Check if owner already has a referral entry
  const [existing] = await db
    .select({ referralCode: ownerReferrals.referralCode })
    .from(ownerReferrals)
    .where(eq(ownerReferrals.referrerOwnerId, ownerId))
    .limit(1);

  if (existing) {
    return {
      code: existing.referralCode,
      shareUrl: `https://www.fuzzycatapp.com/signup/owner?ref=${encodeURIComponent(existing.referralCode)}`,
      discountAmount: OWNER_REFERRAL_DISCOUNT_CENTS,
      creditAmount: OWNER_REFERRAL_CREDIT_CENTS,
    };
  }

  // Create a new referral code
  const code = generateOwnerReferralCode();
  await db.insert(ownerReferrals).values({
    referrerOwnerId: ownerId,
    referralCode: code,
  });

  return {
    code,
    shareUrl: `https://www.fuzzycatapp.com/signup/owner?ref=${encodeURIComponent(code)}`,
    discountAmount: OWNER_REFERRAL_DISCOUNT_CENTS,
    creditAmount: OWNER_REFERRAL_CREDIT_CENTS,
  };
}

/**
 * Get all referrals created by an owner.
 */
export async function getOwnerReferrals(ownerId: string): Promise<OwnerReferralRow[]> {
  return db
    .select({
      id: ownerReferrals.id,
      referralCode: ownerReferrals.referralCode,
      status: ownerReferrals.status,
      creditApplied: ownerReferrals.creditApplied,
      convertedAt: ownerReferrals.convertedAt,
      createdAt: ownerReferrals.createdAt,
    })
    .from(ownerReferrals)
    .where(eq(ownerReferrals.referrerOwnerId, ownerId))
    .orderBy(desc(ownerReferrals.createdAt));
}

// ── Mutations ────────────────────────────────────────────────────────

/**
 * Convert an owner referral when a referred owner signs up.
 */
export async function convertOwnerReferral(
  referralCode: string,
  referredOwnerId: string,
): Promise<{ success: boolean; referrerId?: string }> {
  return await db.transaction(async (tx) => {
    const [referral] = await tx
      .select({
        id: ownerReferrals.id,
        referrerOwnerId: ownerReferrals.referrerOwnerId,
        status: ownerReferrals.status,
      })
      .from(ownerReferrals)
      .where(
        and(eq(ownerReferrals.referralCode, referralCode), eq(ownerReferrals.status, 'pending')),
      )
      .limit(1);

    if (!referral) {
      return { success: false };
    }

    await tx
      .update(ownerReferrals)
      .set({
        referredOwnerId,
        status: 'converted',
        convertedAt: new Date(),
      })
      .where(eq(ownerReferrals.id, referral.id));

    logger.info('Owner referral converted', {
      referralId: referral.id,
      referrerOwnerId: referral.referrerOwnerId,
      referredOwnerId,
    });

    return { success: true, referrerId: referral.referrerOwnerId };
  });
}

/**
 * Get the fee discount for a referred owner's enrollment.
 * Returns 0 if the owner was not referred.
 */
export async function getReferralDiscount(
  ownerId: string,
  queryDb: Pick<typeof db, 'select'> = db,
): Promise<number> {
  const [referral] = await queryDb
    .select({ id: ownerReferrals.id })
    .from(ownerReferrals)
    .where(and(eq(ownerReferrals.referredOwnerId, ownerId), eq(ownerReferrals.status, 'converted')))
    .limit(1);

  return referral ? OWNER_REFERRAL_DISCOUNT_CENTS : 0;
}
