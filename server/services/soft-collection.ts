// ── Soft collection service ─────────────────────────────────────────
// Manages the post-default soft collection workflow. This is NOT formal
// debt collection (no FDCPA). It's a friendly recovery attempt:
//   Day 1:  Reminder email + SMS
//   Day 7:  Follow-up with payment method update link
//   Day 14: Final notice before guarantee claim finalization
//
// Clear boundary: no formal collections without counsel approval.

import { and, eq, inArray, lte } from 'drizzle-orm';
import { publicEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { db } from '@/server/db';
import { owners, plans, softCollections } from '@/server/db/schema';
import { logAuditEvent } from '@/server/services/audit';
import {
  sendSoftCollectionDay1,
  sendSoftCollectionDay7,
  sendSoftCollectionDay14,
} from '@/server/services/email';
import { sendSoftCollectionReminder } from '@/server/services/sms';

// ── Types ─────────────────────────────────────────────────────────────

type SoftCollectionStage =
  | 'day_1_reminder'
  | 'day_7_followup'
  | 'day_14_final'
  | 'completed'
  | 'cancelled';

interface SoftCollectionRecord {
  id: string;
  planId: string;
  stage: SoftCollectionStage;
  startedAt: Date;
  lastEscalatedAt: Date | null;
  nextEscalationAt: Date | null;
  notes: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface PlanOwnerInfo {
  planId: string;
  remainingCents: number;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  petName: string | null;
  clinicId: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Add days to a date and return a new Date. */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Get the next stage in the escalation sequence. */
function getNextStage(currentStage: SoftCollectionStage): SoftCollectionStage | null {
  const stageOrder: Record<string, SoftCollectionStage | null> = {
    day_1_reminder: 'day_7_followup',
    day_7_followup: 'day_14_final',
    day_14_final: 'completed',
    completed: null,
    cancelled: null,
  };
  return stageOrder[currentStage] ?? null;
}

/** Build the update-payment URL for the owner portal. */
function getUpdatePaymentUrl(): string {
  const url = publicEnv().NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${url}/owner/settings`;
}

/** Build the owner dashboard URL. */
function getDashboardUrl(): string {
  const url = publicEnv().NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${url}/owner/dashboard`;
}

/** Calculate next escalation date from stage. */
function calculateNextEscalation(nextStage: SoftCollectionStage, now: Date): Date | null {
  if (nextStage === 'day_7_followup') {
    return addDays(now, 7);
  }
  return null;
}

/** Look up plan + owner info needed for notifications. */
async function getPlanWithOwner(planId: string): Promise<PlanOwnerInfo | null> {
  const [result] = await db
    .select({
      planId: plans.id,
      remainingCents: plans.remainingCents,
      ownerName: owners.name,
      ownerEmail: owners.email,
      ownerPhone: owners.phone,
      petName: owners.petName,
      clinicId: plans.clinicId,
    })
    .from(plans)
    .leftJoin(owners, eq(plans.ownerId, owners.id))
    .where(eq(plans.id, planId))
    .limit(1);

  return result ?? null;
}

/** Send Day 1 email notification. */
async function sendDay1Email(planInfo: PlanOwnerInfo): Promise<void> {
  if (!planInfo.ownerEmail) return;
  try {
    await sendSoftCollectionDay1(planInfo.ownerEmail, {
      ownerName: planInfo.ownerName ?? 'Pet Owner',
      petName: planInfo.petName ?? 'your pet',
      clinicName: planInfo.clinicId ?? 'your clinic',
      remainingCents: planInfo.remainingCents,
      dashboardUrl: getDashboardUrl(),
      updatePaymentUrl: getUpdatePaymentUrl(),
    });
  } catch (error) {
    logger.error('Failed to send Day 1 soft collection email', {
      planId: planInfo.planId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Send Day 1 SMS notification. */
async function sendDay1Sms(planInfo: PlanOwnerInfo): Promise<void> {
  if (!planInfo.ownerPhone) return;
  try {
    await sendSoftCollectionReminder(planInfo.ownerPhone, {
      petName: planInfo.petName ?? 'your pet',
      stage: 'day_1_reminder',
      updatePaymentUrl: getUpdatePaymentUrl(),
    });
  } catch (error) {
    logger.error('Failed to send Day 1 soft collection SMS', {
      planId: planInfo.planId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Send escalation email for Day 7 or Day 14. */
async function sendEscalationEmail(
  planInfo: PlanOwnerInfo,
  stage: SoftCollectionStage,
  collectionId: string,
): Promise<void> {
  if (!planInfo.ownerEmail) return;
  if (stage !== 'day_7_followup' && stage !== 'day_14_final') return;

  try {
    const emailParams = {
      ownerName: planInfo.ownerName ?? 'Pet Owner',
      petName: planInfo.petName ?? 'your pet',
      clinicName: planInfo.clinicId ?? 'your clinic',
      remainingCents: planInfo.remainingCents,
      updatePaymentUrl: getUpdatePaymentUrl(),
    };

    if (stage === 'day_7_followup') {
      await sendSoftCollectionDay7(planInfo.ownerEmail, emailParams);
    } else {
      await sendSoftCollectionDay14(planInfo.ownerEmail, emailParams);
    }
  } catch (error) {
    logger.error('Failed to send soft collection escalation email', {
      collectionId,
      stage,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Send escalation SMS for Day 7 or Day 14. */
async function sendEscalationSms(
  planInfo: PlanOwnerInfo,
  stage: SoftCollectionStage,
  collectionId: string,
): Promise<void> {
  if (!planInfo.ownerPhone) return;
  if (stage !== 'day_7_followup' && stage !== 'day_14_final') return;

  try {
    await sendSoftCollectionReminder(planInfo.ownerPhone, {
      petName: planInfo.petName ?? 'your pet',
      stage,
      updatePaymentUrl: getUpdatePaymentUrl(),
    });
  } catch (error) {
    logger.error('Failed to send soft collection escalation SMS', {
      collectionId,
      stage,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ── Service functions ─────────────────────────────────────────────────

/**
 * Initiate a soft collection process for a defaulted plan.
 * Creates the softCollections record, sends Day 1 notifications,
 * and schedules the Day 7 escalation.
 */
export async function initiateSoftCollection(planId: string): Promise<SoftCollectionRecord> {
  const now = new Date();
  const nextEscalation = addDays(now, 7);

  const [record] = await db
    .insert(softCollections)
    .values({
      planId,
      stage: 'day_1_reminder',
      startedAt: now,
      lastEscalatedAt: now,
      nextEscalationAt: nextEscalation,
    })
    .returning();

  if (!record) {
    throw new Error(`Failed to create soft collection record for plan ${planId}`);
  }

  await logAuditEvent({
    entityType: 'plan',
    entityId: planId,
    action: 'status_changed',
    oldValue: null,
    newValue: { softCollectionStage: 'day_1_reminder' },
    actorType: 'system',
  });

  const planInfo = await getPlanWithOwner(planId);
  if (planInfo) {
    await sendDay1Email(planInfo);
    await sendDay1Sms(planInfo);
  }

  logger.info('Soft collection initiated', {
    collectionId: record.id,
    planId,
    nextEscalation: nextEscalation.toISOString(),
  });

  return record as SoftCollectionRecord;
}

/**
 * Escalate a soft collection to the next stage.
 * Sends stage-appropriate notifications and schedules the next escalation.
 */
export async function escalateSoftCollection(collectionId: string): Promise<SoftCollectionRecord> {
  const [current] = await db
    .select()
    .from(softCollections)
    .where(eq(softCollections.id, collectionId))
    .limit(1);

  if (!current) {
    throw new Error(`Soft collection record not found: ${collectionId}`);
  }

  if (current.stage === 'completed' || current.stage === 'cancelled') {
    throw new Error(`Cannot escalate soft collection in ${current.stage} stage`);
  }

  const nextStage = getNextStage(current.stage);
  if (!nextStage) {
    throw new Error(`No next stage for ${current.stage}`);
  }

  const now = new Date();
  const nextEscalationAt = calculateNextEscalation(nextStage, now);

  const [updated] = await db
    .update(softCollections)
    .set({ stage: nextStage, lastEscalatedAt: now, nextEscalationAt })
    .where(eq(softCollections.id, collectionId))
    .returning();

  if (!updated) {
    throw new Error(`Failed to update soft collection: ${collectionId}`);
  }

  await logAuditEvent({
    entityType: 'plan',
    entityId: current.planId,
    action: 'status_changed',
    oldValue: { softCollectionStage: current.stage },
    newValue: { softCollectionStage: nextStage },
    actorType: 'system',
  });

  const planInfo = await getPlanWithOwner(current.planId);
  if (planInfo) {
    await sendEscalationEmail(planInfo, nextStage, collectionId);
    await sendEscalationSms(planInfo, nextStage, collectionId);
  }

  logger.info('Soft collection escalated', {
    collectionId,
    previousStage: current.stage,
    newStage: nextStage,
  });

  return updated as SoftCollectionRecord;
}

/**
 * Cancel a soft collection (e.g., if the owner pays).
 */
export async function cancelSoftCollection(
  collectionId: string,
  reason: string,
): Promise<SoftCollectionRecord> {
  const [current] = await db
    .select()
    .from(softCollections)
    .where(eq(softCollections.id, collectionId))
    .limit(1);

  if (!current) {
    throw new Error(`Soft collection record not found: ${collectionId}`);
  }

  if (current.stage === 'completed' || current.stage === 'cancelled') {
    throw new Error(`Cannot cancel soft collection in ${current.stage} stage`);
  }

  const [updated] = await db
    .update(softCollections)
    .set({ stage: 'cancelled', nextEscalationAt: null, notes: reason })
    .where(eq(softCollections.id, collectionId))
    .returning();

  if (!updated) {
    throw new Error(`Failed to cancel soft collection: ${collectionId}`);
  }

  await logAuditEvent({
    entityType: 'plan',
    entityId: current.planId,
    action: 'status_changed',
    oldValue: { softCollectionStage: current.stage },
    newValue: { softCollectionStage: 'cancelled', reason },
    actorType: 'system',
  });

  logger.info('Soft collection cancelled', {
    collectionId,
    previousStage: current.stage,
    reason,
  });

  return updated as SoftCollectionRecord;
}

/**
 * Find soft collections where `nextEscalationAt <= now` and stage
 * is not completed or cancelled. These need to be escalated.
 */
export async function identifyPendingEscalations(): Promise<SoftCollectionRecord[]> {
  const now = new Date();

  const pending = await db
    .select()
    .from(softCollections)
    .where(
      and(
        lte(softCollections.nextEscalationAt, now),
        inArray(softCollections.stage, ['day_1_reminder', 'day_7_followup', 'day_14_final']),
      ),
    );

  logger.info('Identified pending escalations', { count: pending.length });

  return pending as SoftCollectionRecord[];
}

/**
 * Get the soft collection record for a specific plan.
 */
export async function getSoftCollectionByPlan(
  planId: string,
): Promise<SoftCollectionRecord | null> {
  const [record] = await db
    .select()
    .from(softCollections)
    .where(eq(softCollections.planId, planId))
    .limit(1);

  return (record as SoftCollectionRecord) ?? null;
}
