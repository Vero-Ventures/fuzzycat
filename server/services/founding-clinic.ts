import { eq, sql } from 'drizzle-orm';
import {
  FOUNDING_CLINIC_DURATION_MONTHS,
  FOUNDING_CLINIC_LIMIT,
  FOUNDING_CLINIC_SHARE_BPS,
} from '@/lib/constants';
import { serverEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { addMonths } from '@/lib/utils/date';
import { db } from '@/server/db';
import { clinics } from '@/server/db/schema';

// ── Feature flag ─────────────────────────────────────────────────────

/** Returns true if the Founding Clinic program is enabled via ENABLE_FOUNDING_CLINIC env var. */
export function isFoundingClinicEnabled(): boolean {
  return serverEnv().ENABLE_FOUNDING_CLINIC === 'true';
}

// ── Types ────────────────────────────────────────────────────────────

export interface FoundingClinicStatus {
  enabled: boolean;
  isFoundingClinic: boolean;
  expiresAt: Date | null;
  spotsRemaining: number;
}

// ── Queries ──────────────────────────────────────────────────────────

export async function getFoundingClinicCount(): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(clinics)
    .where(eq(clinics.foundingClinic, true));
  return result?.count ?? 0;
}

export async function isFoundingClinicAvailable(): Promise<boolean> {
  const count = await getFoundingClinicCount();
  return count < FOUNDING_CLINIC_LIMIT;
}

export async function getFoundingClinicStatus(clinicId: string): Promise<FoundingClinicStatus> {
  if (!isFoundingClinicEnabled()) {
    return {
      enabled: false,
      isFoundingClinic: false,
      expiresAt: null,
      spotsRemaining: 0,
    };
  }

  const [clinic] = await db
    .select({
      foundingClinic: clinics.foundingClinic,
      foundingExpiresAt: clinics.foundingExpiresAt,
    })
    .from(clinics)
    .where(eq(clinics.id, clinicId))
    .limit(1);

  const count = await getFoundingClinicCount();
  const spotsRemaining = Math.max(0, FOUNDING_CLINIC_LIMIT - count);

  return {
    enabled: true,
    isFoundingClinic: clinic?.foundingClinic ?? false,
    expiresAt: clinic?.foundingExpiresAt ?? null,
    spotsRemaining,
  };
}

// ── Mutations ────────────────────────────────────────────────────────

export async function enrollAsFoundingClinic(
  clinicId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isFoundingClinicEnabled()) {
    return { success: false, error: 'Founding Clinic program is not currently available' };
  }

  return await db.transaction(async (tx) => {
    // Lock and check current state
    const [clinic] = await tx
      .select({
        foundingClinic: clinics.foundingClinic,
      })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    if (!clinic) {
      return { success: false, error: 'Clinic not found' };
    }

    if (clinic.foundingClinic) {
      return { success: false, error: 'Already enrolled as a Founding Clinic' };
    }

    // Count existing founding clinics
    const [countResult] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(clinics)
      .where(eq(clinics.foundingClinic, true));

    const currentCount = countResult?.count ?? 0;
    if (currentCount >= FOUNDING_CLINIC_LIMIT) {
      return { success: false, error: 'Founding Clinic program is full' };
    }

    const expiresAt = addMonths(new Date(), FOUNDING_CLINIC_DURATION_MONTHS);

    await tx
      .update(clinics)
      .set({
        foundingClinic: true,
        revenueShareBps: FOUNDING_CLINIC_SHARE_BPS,
        foundingExpiresAt: expiresAt,
      })
      .where(eq(clinics.id, clinicId));

    logger.info('Clinic enrolled as Founding Clinic', {
      clinicId,
      revenueShareBps: FOUNDING_CLINIC_SHARE_BPS,
      expiresAt: expiresAt.toISOString(),
      spotsRemaining: FOUNDING_CLINIC_LIMIT - currentCount - 1,
    });

    return { success: true };
  });
}
