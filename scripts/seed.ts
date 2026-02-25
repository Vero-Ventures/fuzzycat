import {
  CLINIC_SHARE_RATE,
  DEPOSIT_RATE,
  NUM_INSTALLMENTS,
  PLATFORM_FEE_RATE,
  PLATFORM_RESERVE_RATE,
} from '@/lib/constants';
import { db } from '@/server/db';
import { auditLog, clinics, owners, payments, payouts, plans, riskPool } from '@/server/db/schema';
import {
  CLINIC_1_AUTH_ID,
  CLINIC_1_ID,
  CLINIC_2_AUTH_ID,
  CLINIC_2_ID,
  OWNER_1_AUTH_ID,
  OWNER_1_ID,
  OWNER_2_AUTH_ID,
  OWNER_2_ID,
  OWNER_3_AUTH_ID,
  OWNER_3_ID,
  PAYMENT_1_DEPOSIT_ID,
  PAYMENT_1_INST_1_ID,
  PAYMENT_1_INST_2_ID,
  PAYMENT_1_INST_3_ID,
  PAYMENT_1_INST_4_ID,
  PAYMENT_1_INST_5_ID,
  PAYMENT_1_INST_6_ID,
  PAYOUT_1_ID,
  PAYOUT_2_ID,
  PAYOUT_3_ID,
  PLAN_1_BILL_CENTS,
  PLAN_1_ID,
  PLAN_2_BILL_CENTS,
  PLAN_2_ID,
  PLAN_3_BILL_CENTS,
  PLAN_3_ID,
} from './seed-constants';

// ── Payment calculation helpers (mirrors FuzzyCat formula) ──────────
function calculatePlan(billCents: number) {
  const feeCents = Math.round(billCents * PLATFORM_FEE_RATE);
  const totalWithFeeCents = billCents + feeCents;
  const depositCents = Math.round(totalWithFeeCents * DEPOSIT_RATE);
  const remainingCents = totalWithFeeCents - depositCents;
  const installmentCents = Math.round(remainingCents / NUM_INSTALLMENTS);
  return { feeCents, totalWithFeeCents, depositCents, remainingCents, installmentCents };
}

const plan1Calc = calculatePlan(PLAN_1_BILL_CENTS);
const plan2Calc = calculatePlan(PLAN_2_BILL_CENTS);
const plan3Calc = calculatePlan(PLAN_3_BILL_CENTS);

const now = new Date();
const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;

async function seed() {
  await db.transaction(async (tx) => {
    console.log('Cleaning existing seed data...');

    // Delete in reverse FK order to avoid constraint violations
    await tx.delete(auditLog);
    await tx.delete(riskPool);
    await tx.delete(payouts);
    await tx.delete(payments);
    await tx.delete(plans);
    await tx.delete(owners);
    await tx.delete(clinics);

    console.log('Seeding clinics...');
    await tx.insert(clinics).values([
      {
        id: CLINIC_1_ID,
        authId: CLINIC_1_AUTH_ID,
        name: 'Sunset Veterinary Hospital',
        phone: '(415) 555-0101',
        email: 'admin@sunsetvet.example.com',
        addressLine1: '1234 Sunset Blvd',
        addressCity: 'San Francisco',
        addressState: 'CA',
        addressZip: '94122',
        stripeAccountId: 'acct_test_sunset',
        status: 'active',
      },
      {
        id: CLINIC_2_ID,
        authId: CLINIC_2_AUTH_ID,
        name: 'Pacific Paws Animal Clinic',
        phone: '(310) 555-0202',
        email: 'front@pacificpaws.example.com',
        addressLine1: '5678 Pacific Ave',
        addressCity: 'Los Angeles',
        addressState: 'CA',
        addressZip: '90291',
        stripeAccountId: 'acct_test_pacific',
        status: 'active',
      },
    ]);

    console.log('Seeding owners...');
    await tx.insert(owners).values([
      {
        id: OWNER_1_ID,
        authId: OWNER_1_AUTH_ID,
        name: 'Alice Johnson',
        email: 'alice@example.com',
        phone: '(415) 555-1001',
        addressLine1: '100 Market St',
        addressCity: 'San Francisco',
        addressState: 'CA',
        addressZip: '94105',
        petName: 'Whiskers',
        stripeCustomerId: 'cus_test_alice',
        paymentMethod: 'debit_card',
      },
      {
        id: OWNER_2_ID,
        authId: OWNER_2_AUTH_ID,
        name: 'Bob Martinez',
        email: 'bob@example.com',
        phone: '(415) 555-1002',
        addressLine1: '200 Mission St',
        addressCity: 'San Francisco',
        addressState: 'CA',
        addressZip: '94105',
        petName: 'Mittens',
        stripeCustomerId: 'cus_test_bob',
        paymentMethod: 'bank_account',
      },
      {
        id: OWNER_3_ID,
        authId: OWNER_3_AUTH_ID,
        name: 'Carol Chen',
        email: 'carol@example.com',
        phone: '(310) 555-2001',
        addressLine1: '300 Venice Blvd',
        addressCity: 'Los Angeles',
        addressState: 'CA',
        addressZip: '90291',
        petName: 'Luna',
        stripeCustomerId: 'cus_test_carol',
        paymentMethod: 'debit_card',
      },
    ]);

    console.log('Seeding plans...');
    const plan1Start = new Date(now.getTime() - 4 * twoWeeksMs); // Started 8 weeks ago
    await tx.insert(plans).values([
      {
        id: PLAN_1_ID,
        ownerId: OWNER_1_ID,
        clinicId: CLINIC_1_ID,
        totalBillCents: PLAN_1_BILL_CENTS,
        ...plan1Calc,
        numInstallments: NUM_INSTALLMENTS,
        status: 'active',
        depositPaidAt: plan1Start,
        nextPaymentAt: new Date(plan1Start.getTime() + 3 * twoWeeksMs),
      },
      {
        id: PLAN_2_ID,
        ownerId: OWNER_2_ID,
        clinicId: CLINIC_1_ID,
        totalBillCents: PLAN_2_BILL_CENTS,
        ...plan2Calc,
        numInstallments: NUM_INSTALLMENTS,
        status: 'pending',
      },
      {
        id: PLAN_3_ID,
        ownerId: OWNER_3_ID,
        clinicId: CLINIC_2_ID,
        totalBillCents: PLAN_3_BILL_CENTS,
        ...plan3Calc,
        numInstallments: NUM_INSTALLMENTS,
        status: 'completed',
        depositPaidAt: new Date(now.getTime() - 7 * twoWeeksMs),
        completedAt: new Date(now.getTime() - twoWeeksMs),
      },
    ]);

    console.log('Seeding payments for plan 1...');
    // Plan 1: deposit succeeded, installments 1-2 succeeded, 3-6 pending
    await tx.insert(payments).values([
      {
        id: PAYMENT_1_DEPOSIT_ID,
        planId: PLAN_1_ID,
        type: 'deposit',
        sequenceNum: 0,
        amountCents: plan1Calc.depositCents,
        status: 'succeeded',
        stripePaymentIntentId: 'pi_test_dep_001',
        scheduledAt: plan1Start,
        processedAt: plan1Start,
      },
      {
        id: PAYMENT_1_INST_1_ID,
        planId: PLAN_1_ID,
        type: 'installment',
        sequenceNum: 1,
        amountCents: plan1Calc.installmentCents,
        status: 'succeeded',
        stripePaymentIntentId: 'pi_test_inst_001',
        scheduledAt: new Date(plan1Start.getTime() + twoWeeksMs),
        processedAt: new Date(plan1Start.getTime() + twoWeeksMs),
      },
      {
        id: PAYMENT_1_INST_2_ID,
        planId: PLAN_1_ID,
        type: 'installment',
        sequenceNum: 2,
        amountCents: plan1Calc.installmentCents,
        status: 'succeeded',
        stripePaymentIntentId: 'pi_test_inst_002',
        scheduledAt: new Date(plan1Start.getTime() + 2 * twoWeeksMs),
        processedAt: new Date(plan1Start.getTime() + 2 * twoWeeksMs),
      },
      {
        id: PAYMENT_1_INST_3_ID,
        planId: PLAN_1_ID,
        type: 'installment',
        sequenceNum: 3,
        amountCents: plan1Calc.installmentCents,
        status: 'pending',
        scheduledAt: new Date(plan1Start.getTime() + 3 * twoWeeksMs),
      },
      {
        id: PAYMENT_1_INST_4_ID,
        planId: PLAN_1_ID,
        type: 'installment',
        sequenceNum: 4,
        amountCents: plan1Calc.installmentCents,
        status: 'pending',
        scheduledAt: new Date(plan1Start.getTime() + 4 * twoWeeksMs),
      },
      {
        id: PAYMENT_1_INST_5_ID,
        planId: PLAN_1_ID,
        type: 'installment',
        sequenceNum: 5,
        amountCents: plan1Calc.installmentCents,
        status: 'pending',
        scheduledAt: new Date(plan1Start.getTime() + 5 * twoWeeksMs),
      },
      {
        id: PAYMENT_1_INST_6_ID,
        planId: PLAN_1_ID,
        type: 'installment',
        sequenceNum: 6,
        amountCents: plan1Calc.installmentCents,
        status: 'pending',
        scheduledAt: new Date(plan1Start.getTime() + 6 * twoWeeksMs),
      },
    ]);

    console.log('Seeding payouts...');
    // Payouts for the 3 succeeded payments (deposit + installments 1-2)
    await tx.insert(payouts).values([
      {
        id: PAYOUT_1_ID,
        clinicId: CLINIC_1_ID,
        planId: PLAN_1_ID,
        paymentId: PAYMENT_1_DEPOSIT_ID,
        amountCents: plan1Calc.depositCents,
        clinicShareCents: Math.round(
          PLAN_1_BILL_CENTS *
            CLINIC_SHARE_RATE *
            (plan1Calc.depositCents / plan1Calc.totalWithFeeCents),
        ),
        stripeTransferId: 'tr_test_001',
        status: 'succeeded',
      },
      {
        id: PAYOUT_2_ID,
        clinicId: CLINIC_1_ID,
        planId: PLAN_1_ID,
        paymentId: PAYMENT_1_INST_1_ID,
        amountCents: plan1Calc.installmentCents,
        clinicShareCents: Math.round(
          PLAN_1_BILL_CENTS *
            CLINIC_SHARE_RATE *
            (plan1Calc.installmentCents / plan1Calc.totalWithFeeCents),
        ),
        stripeTransferId: 'tr_test_002',
        status: 'succeeded',
      },
      {
        id: PAYOUT_3_ID,
        clinicId: CLINIC_1_ID,
        planId: PLAN_1_ID,
        paymentId: PAYMENT_1_INST_2_ID,
        amountCents: plan1Calc.installmentCents,
        clinicShareCents: Math.round(
          PLAN_1_BILL_CENTS *
            CLINIC_SHARE_RATE *
            (plan1Calc.installmentCents / plan1Calc.totalWithFeeCents),
        ),
        stripeTransferId: 'tr_test_003',
        status: 'succeeded',
      },
    ]);

    console.log('Seeding risk pool...');
    await tx.insert(riskPool).values({
      planId: PLAN_1_ID,
      contributionCents: Math.round(PLAN_1_BILL_CENTS * PLATFORM_RESERVE_RATE),
      type: 'contribution',
    });

    console.log('Seeding audit log...');
    await tx.insert(auditLog).values([
      {
        entityType: 'plan',
        entityId: PLAN_1_ID,
        action: 'created',
        oldValue: null,
        newValue: { status: 'pending', totalBillCents: PLAN_1_BILL_CENTS },
        actorType: 'system',
        actorId: null,
        ipAddress: '127.0.0.1',
      },
      {
        entityType: 'plan',
        entityId: PLAN_1_ID,
        action: 'status_changed',
        oldValue: { status: 'pending' },
        newValue: { status: 'active' },
        actorType: 'system',
        actorId: null,
        ipAddress: '127.0.0.1',
      },
    ]);

    console.log('Seed complete.');
  });
}

seed()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
