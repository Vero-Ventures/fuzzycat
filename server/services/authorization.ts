// ── Authorization helpers for enrollment operations ──────────────────
// Verifies that authenticated users have permission to access or modify
// specific clinic or plan resources.

import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import type { UserRole } from '@/lib/auth';
import { db } from '@/server/db';
import { clinics, owners, plans } from '@/server/db/schema';

/** Resolve the clinic row ID for the authenticated user. */
export async function resolveClinicId(database: typeof db, userId: string): Promise<string> {
  const [clinic] = await database
    .select({ id: clinics.id })
    .from(clinics)
    .where(eq(clinics.authId, userId))
    .limit(1);

  if (!clinic) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Clinic profile not found' });
  }
  return clinic.id;
}

/** Resolve the owner row ID for the authenticated user. */
export async function resolveOwnerId(database: typeof db, userId: string): Promise<string> {
  const [owner] = await database
    .select({ id: owners.id })
    .from(owners)
    .where(eq(owners.authId, userId))
    .limit(1);

  if (!owner) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Owner profile not found' });
  }
  return owner.id;
}

/**
 * Verify that the authenticated user's clinic matches the provided clinicId.
 * Looks up the clinic by authId (the Supabase auth user ID).
 * Throws FORBIDDEN if the clinic doesn't match.
 */
export async function assertClinicOwnership(userId: string, clinicId: string): Promise<void> {
  const [clinic] = await db
    .select({ id: clinics.id })
    .from(clinics)
    .where(eq(clinics.authId, userId))
    .limit(1);

  if (!clinic || clinic.id !== clinicId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to perform this action for this clinic',
    });
  }
}

/**
 * Verify that the authenticated user is the clinic or the pet owner associated
 * with a plan. Admin users are always allowed.
 * Returns the plan's clinicId and ownerId for downstream use.
 */
export async function assertPlanAccess(
  userId: string,
  role: UserRole,
  planId: string,
): Promise<{ clinicId: string | null; ownerId: string | null }> {
  const [plan] = await db
    .select({ clinicId: plans.clinicId, ownerId: plans.ownerId })
    .from(plans)
    .where(eq(plans.id, planId))
    .limit(1);

  if (!plan) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `Plan ${planId} not found` });
  }

  // Admin users bypass ownership checks
  if (role === 'admin') {
    return plan;
  }

  if (role === 'clinic') {
    const [clinic] = await db
      .select({ id: clinics.id })
      .from(clinics)
      .where(eq(clinics.authId, userId))
      .limit(1);

    if (clinic && clinic.id === plan.clinicId) {
      return plan;
    }
  }

  if (role === 'owner') {
    const [owner] = await db
      .select({ id: owners.id })
      .from(owners)
      .where(eq(owners.authId, userId))
      .limit(1);

    if (owner && owner.id === plan.ownerId) {
      return plan;
    }
  }

  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'You do not have permission to access this plan',
  });
}
