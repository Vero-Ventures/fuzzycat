// ── Enrollment service: plan creation business logic ─────────────────
// Orchestrates plan creation, payment schedule generation, and initial
// payment records. All financial operations are wrapped in db.transaction().

import { and, eq, inArray } from 'drizzle-orm';
import { MIN_BILL_CENTS, PLATFORM_RESERVE_RATE } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { percentOfCents } from '@/lib/utils/money';
import { calculatePaymentSchedule } from '@/lib/utils/schedule';
import { db } from '@/server/db';
import { clinics, owners, payments, plans, riskPool, softCollections } from '@/server/db/schema';
import { logAuditEvent } from '@/server/services/audit';

// ── Types ────────────────────────────────────────────────────────────

export interface OwnerData {
  name: string;
  email: string;
  phone: string;
  petName: string;
  paymentMethod: 'debit_card' | 'bank_account';
  addressLine1?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
}

export interface CreateEnrollmentResult {
  planId: string;
  ownerId: string;
  paymentIds: string[];
}

export interface EnrollmentSummary {
  plan: {
    id: string;
    status: string;
    totalBillCents: number;
    feeCents: number;
    totalWithFeeCents: number;
    depositCents: number;
    remainingCents: number;
    installmentCents: number;
    numInstallments: number;
    createdAt: Date | null;
  };
  owner: {
    id: string;
    name: string;
    email: string;
    phone: string;
    petName: string;
  };
  clinic: {
    id: string;
    name: string;
  };
  payments: {
    id: string;
    type: string;
    sequenceNum: number | null;
    amountCents: number;
    status: string;
    scheduledAt: Date;
  }[];
}

// ── Service functions ────────────────────────────────────────────────

/**
 * Create a new enrollment: owner record, plan, payment records, risk pool
 * contribution, and audit trail. All within a single database transaction.
 *
 * @param clinicId - UUID of the clinic
 * @param ownerData - Pet owner details
 * @param billAmountCents - The vet bill in integer cents (minimum 50000 = $500)
 * @param actorId - UUID of the actor creating the enrollment (for audit log)
 * @param enrollmentDate - Date the plan starts (defaults to now)
 */
export async function createEnrollment(
  clinicId: string,
  ownerData: OwnerData,
  billAmountCents: number,
  actorId?: string,
  enrollmentDate: Date = new Date(),
): Promise<CreateEnrollmentResult> {
  // ── Validate bill minimum ────────────────────────────────────────
  if (billAmountCents < MIN_BILL_CENTS) {
    throw new Error(
      `Bill amount ${billAmountCents} cents is below minimum ${MIN_BILL_CENTS} cents ($${MIN_BILL_CENTS / 100})`,
    );
  }

  // ── Validate clinic exists and is active ─────────────────────────
  const [clinic] = await db
    .select({ id: clinics.id, status: clinics.status })
    .from(clinics)
    .where(eq(clinics.id, clinicId))
    .limit(1);

  if (!clinic) {
    throw new Error(`Clinic ${clinicId} not found`);
  }

  if (clinic.status !== 'active') {
    throw new Error(`Clinic ${clinicId} is not active (status: ${clinic.status})`);
  }

  // ── Calculate payment schedule ───────────────────────────────────
  const schedule = calculatePaymentSchedule(billAmountCents, enrollmentDate);

  // ── Risk pool contribution (1% of total with fee) ────────────────
  const riskPoolContributionCents = percentOfCents(
    schedule.totalWithFeeCents,
    PLATFORM_RESERVE_RATE,
  );

  // ── Execute all inserts in a single transaction ──────────────────
  return await db.transaction(async (tx) => {
    // 1. Create or find owner record (lookup by email only — email has a global unique constraint)
    const [existingOwner] = await tx
      .select({ id: owners.id })
      .from(owners)
      .where(eq(owners.email, ownerData.email))
      .limit(1);

    let ownerId: string;

    if (existingOwner) {
      ownerId = existingOwner.id;
      // Update owner details in case they changed
      await tx
        .update(owners)
        .set({
          name: ownerData.name,
          phone: ownerData.phone,
          petName: ownerData.petName,
          paymentMethod: ownerData.paymentMethod,
          addressLine1: ownerData.addressLine1,
          addressCity: ownerData.addressCity,
          addressState: ownerData.addressState,
          addressZip: ownerData.addressZip,
        })
        .where(eq(owners.id, existingOwner.id));
    } else {
      const [newOwner] = await tx
        .insert(owners)
        .values({
          name: ownerData.name,
          email: ownerData.email,
          phone: ownerData.phone,
          petName: ownerData.petName,
          paymentMethod: ownerData.paymentMethod,
          addressLine1: ownerData.addressLine1,
          addressCity: ownerData.addressCity,
          addressState: ownerData.addressState,
          addressZip: ownerData.addressZip,
        })
        .returning({ id: owners.id });
      ownerId = newOwner.id;
    }

    // 2. Create plan record (status: 'pending')
    const [plan] = await tx
      .insert(plans)
      .values({
        ownerId,
        clinicId,
        totalBillCents: schedule.totalBillCents,
        feeCents: schedule.feeCents,
        totalWithFeeCents: schedule.totalWithFeeCents,
        depositCents: schedule.depositCents,
        remainingCents: schedule.remainingCents,
        installmentCents: schedule.installmentCents,
        numInstallments: schedule.numInstallments,
        status: 'pending',
        nextPaymentAt: schedule.payments[0].scheduledAt,
      })
      .returning({ id: plans.id });

    // 3. Create all 7 payment records (1 deposit + 6 installments)
    const paymentValues = schedule.payments.map((p) => ({
      planId: plan.id,
      type: p.type as 'deposit' | 'installment',
      sequenceNum: p.sequenceNum,
      amountCents: p.amountCents,
      status: 'pending' as const,
      scheduledAt: p.scheduledAt,
    }));

    const insertedPayments = await tx
      .insert(payments)
      .values(paymentValues)
      .returning({ id: payments.id });

    const paymentIds = insertedPayments.map((p) => p.id);

    // 4. Create risk pool contribution record
    await tx.insert(riskPool).values({
      planId: plan.id,
      contributionCents: riskPoolContributionCents,
      type: 'contribution',
    });

    // 5. Audit log entries
    // Log plan creation
    await logAuditEvent(
      {
        entityType: 'plan',
        entityId: plan.id,
        action: 'created',
        oldValue: null,
        newValue: {
          status: 'pending',
          totalBillCents: schedule.totalBillCents,
          totalWithFeeCents: schedule.totalWithFeeCents,
          depositCents: schedule.depositCents,
          numInstallments: schedule.numInstallments,
          clinicId,
          ownerId,
        },
        actorType: actorId ? 'clinic' : 'system',
        actorId: actorId ?? null,
      },
      tx,
    );

    // Log risk pool contribution
    await logAuditEvent(
      {
        entityType: 'risk_pool',
        entityId: plan.id,
        action: 'contribution',
        oldValue: null,
        newValue: {
          contributionCents: riskPoolContributionCents,
          planId: plan.id,
        },
        actorType: 'system',
        actorId: null,
      },
      tx,
    );

    return {
      planId: plan.id,
      ownerId,
      paymentIds,
    };
  });
}

/**
 * Get a full enrollment summary for a plan — used for the review screen.
 *
 * @param planId - UUID of the plan
 */
export async function getEnrollmentSummary(planId: string): Promise<EnrollmentSummary> {
  const result = await db.query.plans.findFirst({
    where: eq(plans.id, planId),
    with: {
      owner: true,
      clinic: true,
      payments: true,
    },
  });

  if (!result) {
    throw new Error(`Plan ${planId} not found`);
  }

  if (!result.owner) {
    throw new Error(`Plan ${planId} has no associated owner`);
  }

  if (!result.clinic) {
    throw new Error(`Plan ${planId} has no associated clinic`);
  }

  return {
    plan: {
      id: result.id,
      status: result.status,
      totalBillCents: result.totalBillCents,
      feeCents: result.feeCents,
      totalWithFeeCents: result.totalWithFeeCents,
      depositCents: result.depositCents,
      remainingCents: result.remainingCents,
      installmentCents: result.installmentCents,
      numInstallments: result.numInstallments,
      createdAt: result.createdAt,
    },
    owner: {
      id: result.owner.id,
      name: result.owner.name,
      email: result.owner.email,
      phone: result.owner.phone,
      petName: result.owner.petName,
    },
    clinic: {
      id: result.clinic.id,
      name: result.clinic.name,
    },
    payments: result.payments.map((p) => ({
      id: p.id,
      type: p.type,
      sequenceNum: p.sequenceNum,
      amountCents: p.amountCents,
      status: p.status,
      scheduledAt: p.scheduledAt,
    })),
  };
}

/** Plan statuses that are eligible for cancellation. */
const CANCELLABLE_STATUSES = ['pending', 'deposit_paid', 'active'] as const;

/** Payment statuses that should be written off when a plan is cancelled. */
const CANCELLABLE_PAYMENT_STATUSES = ['pending', 'processing'] as const;

/**
 * Cancel an enrollment. Allowed for plans in pending, deposit_paid, or active
 * status. All future pending/processing payments are written off and each
 * status change is individually audit-logged (NON-NEGOTIABLE per CLAUDE.md).
 * Any associated soft collection is also cancelled.
 *
 * @param planId - UUID of the plan to cancel
 * @param actorId - UUID of the actor cancelling (for audit log)
 * @param actorType - Type of actor ('owner' | 'clinic' | 'admin' | 'system')
 */
export async function cancelEnrollment(
  planId: string,
  actorId?: string,
  actorType: 'owner' | 'clinic' | 'admin' | 'system' = 'system',
): Promise<void> {
  const [planRecord] = await db
    .select({ id: plans.id, status: plans.status })
    .from(plans)
    .where(eq(plans.id, planId))
    .limit(1);

  if (!planRecord) {
    throw new Error(`Plan ${planId} not found`);
  }

  const cancellable: readonly string[] = CANCELLABLE_STATUSES;
  if (!cancellable.includes(planRecord.status)) {
    throw new Error(
      `Cannot cancel plan ${planId}: status is '${planRecord.status}', must be one of: ${CANCELLABLE_STATUSES.join(', ')}`,
    );
  }

  await db.transaction(async (tx) => {
    // 1. Update plan status to cancelled
    await tx.update(plans).set({ status: 'cancelled' }).where(eq(plans.id, planId));

    // 2. Fetch all pending/processing payments to write off individually
    const pendingPayments = await tx
      .select({ id: payments.id, status: payments.status })
      .from(payments)
      .where(
        and(
          eq(payments.planId, planId),
          inArray(payments.status, [...CANCELLABLE_PAYMENT_STATUSES]),
        ),
      );

    // 3. Bulk-update pending/processing payments to written_off
    if (pendingPayments.length > 0) {
      await tx
        .update(payments)
        .set({ status: 'written_off' })
        .where(
          and(
            eq(payments.planId, planId),
            inArray(payments.status, [...CANCELLABLE_PAYMENT_STATUSES]),
          ),
        );

      // 4. Audit each payment status change individually (NON-NEGOTIABLE)
      for (const payment of pendingPayments) {
        await logAuditEvent(
          {
            entityType: 'payment',
            entityId: payment.id,
            action: 'status_changed',
            oldValue: { status: payment.status },
            newValue: { status: 'written_off', reason: 'plan_cancelled' },
            actorType,
            actorId: actorId ?? null,
          },
          tx,
        );
      }
    }

    // 5. Cancel any associated soft collection
    const [existingCollection] = await tx
      .select({ id: softCollections.id, stage: softCollections.stage })
      .from(softCollections)
      .where(eq(softCollections.planId, planId))
      .limit(1);

    if (
      existingCollection &&
      existingCollection.stage !== 'completed' &&
      existingCollection.stage !== 'cancelled'
    ) {
      await tx
        .update(softCollections)
        .set({
          stage: 'cancelled',
          nextEscalationAt: null,
          notes: 'Collection cancelled when plan was cancelled',
        })
        .where(eq(softCollections.id, existingCollection.id));

      await logAuditEvent(
        {
          entityType: 'plan',
          entityId: planId,
          action: 'status_changed',
          oldValue: { softCollectionStage: existingCollection.stage },
          newValue: {
            softCollectionStage: 'cancelled',
            reason: 'Collection cancelled when plan was cancelled',
          },
          actorType,
          actorId: actorId ?? null,
        },
        tx,
      );
    }

    // 6. Audit the plan status change
    await logAuditEvent(
      {
        entityType: 'plan',
        entityId: planId,
        action: 'status_changed',
        oldValue: { status: planRecord.status },
        newValue: { status: 'cancelled' },
        actorType,
        actorId: actorId ?? null,
      },
      tx,
    );

    logger.info('Plan cancelled', {
      planId,
      previousStatus: planRecord.status,
      paymentsWrittenOff: pendingPayments.length,
      actorType,
      actorId,
    });
  });
}
