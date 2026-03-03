import { randomBytes } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { CLINIC_REFERRAL_BONUS_BPS, CLINIC_REFERRAL_BONUS_MONTHS } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { db } from '@/server/db';
import { clinicReferrals, clinics } from '@/server/db/schema';

// ── Types ────────────────────────────────────────────────────────────

export interface ClinicReferralRow {
  id: string;
  referredEmail: string;
  referralCode: string;
  status: 'pending' | 'converted' | 'expired';
  convertedAt: Date | null;
  createdAt: Date | null;
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Generate a human-readable referral code for a clinic.
 * Format: FC-CLINICNAME-XXXX (4 random hex chars)
 */
export function generateClinicReferralCode(clinicName: string): string {
  const sanitized = clinicName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
  const hex = randomBytes(2).toString('hex').toUpperCase();
  return `FC-${sanitized || 'CLINIC'}-${hex}`;
}

// ── Queries ──────────────────────────────────────────────────────────

/**
 * Get or generate a clinic's referral code.
 */
export async function getClinicReferralCode(
  clinicId: string,
): Promise<{ code: string; shareUrl: string }> {
  const [clinic] = await db
    .select({ referralCode: clinics.referralCode, name: clinics.name })
    .from(clinics)
    .where(eq(clinics.id, clinicId))
    .limit(1);

  if (!clinic) throw new Error('Clinic not found');

  let code = clinic.referralCode;
  if (!code) {
    code = generateClinicReferralCode(clinic.name);
    await db.update(clinics).set({ referralCode: code }).where(eq(clinics.id, clinicId));
  }

  return {
    code,
    shareUrl: `https://www.fuzzycatapp.com/signup/clinic?ref=${encodeURIComponent(code)}`,
  };
}

/**
 * Get all referrals created by a clinic.
 */
export async function getClinicReferrals(clinicId: string): Promise<ClinicReferralRow[]> {
  return db
    .select({
      id: clinicReferrals.id,
      referredEmail: clinicReferrals.referredEmail,
      referralCode: clinicReferrals.referralCode,
      status: clinicReferrals.status,
      convertedAt: clinicReferrals.convertedAt,
      createdAt: clinicReferrals.createdAt,
    })
    .from(clinicReferrals)
    .where(eq(clinicReferrals.referrerClinicId, clinicId))
    .orderBy(desc(clinicReferrals.createdAt));
}

// ── Mutations ────────────────────────────────────────────────────────

/**
 * Create a clinic referral invitation.
 */
export async function createClinicReferral(
  referrerClinicId: string,
  referredEmail: string,
): Promise<{ id: string; referralCode: string; shareUrl: string }> {
  const { code } = await getClinicReferralCode(referrerClinicId);

  const [referral] = await db
    .insert(clinicReferrals)
    .values({
      referrerClinicId,
      referredEmail,
      referralCode: code,
    })
    .returning({ id: clinicReferrals.id });

  logger.info('Clinic referral created', {
    referrerClinicId,
    referredEmail,
    referralCode: code,
  });

  return {
    id: referral.id,
    referralCode: code,
    shareUrl: `https://www.fuzzycatapp.com/signup/clinic?ref=${encodeURIComponent(code)}`,
  };
}

/**
 * Convert a clinic referral when a referred clinic signs up.
 * Awards the referrer a temporary BPS bonus.
 */
export async function convertClinicReferral(
  referralCode: string,
  referredClinicId: string,
): Promise<{ success: boolean }> {
  return await db.transaction(async (tx) => {
    // Find pending referral with this code
    const [referral] = await tx
      .select({
        id: clinicReferrals.id,
        referrerClinicId: clinicReferrals.referrerClinicId,
        status: clinicReferrals.status,
      })
      .from(clinicReferrals)
      .where(
        and(eq(clinicReferrals.referralCode, referralCode), eq(clinicReferrals.status, 'pending')),
      )
      .limit(1);

    if (!referral) {
      return { success: false };
    }

    // Mark referral as converted
    await tx
      .update(clinicReferrals)
      .set({
        referredClinicId,
        status: 'converted',
        convertedAt: new Date(),
      })
      .where(eq(clinicReferrals.id, referral.id));

    // Award referrer a temporary BPS bonus
    const [referrerClinic] = await tx
      .select({ revenueShareBps: clinics.revenueShareBps })
      .from(clinics)
      .where(eq(clinics.id, referral.referrerClinicId))
      .limit(1);

    if (referrerClinic) {
      const newBps = Math.min(
        referrerClinic.revenueShareBps + CLINIC_REFERRAL_BONUS_BPS,
        1000, // cap at 10%
      );
      await tx
        .update(clinics)
        .set({ revenueShareBps: newBps })
        .where(eq(clinics.id, referral.referrerClinicId));

      logger.info('Clinic referral converted, bonus applied', {
        referralId: referral.id,
        referrerClinicId: referral.referrerClinicId,
        referredClinicId,
        newBps,
        bonusDurationMonths: CLINIC_REFERRAL_BONUS_MONTHS,
      });
    }

    return { success: true };
  });
}
