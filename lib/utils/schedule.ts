// ── Payment schedule calculator ──────────────────────────────────────
// 6% fee, 25% deposit, 6 biweekly installments over 12 weeks.
// $500 minimum bill validation.

import { DEPOSIT_RATE, MIN_BILL_CENTS, NUM_INSTALLMENTS, PLATFORM_FEE_RATE } from '@/lib/constants';
import { percentOfCents } from '@/lib/utils/money';

export interface ScheduledPayment {
  type: 'deposit' | 'installment';
  sequenceNum: number;
  amountCents: number;
  scheduledAt: Date;
}

export interface PaymentSchedule {
  totalBillCents: number;
  feeCents: number;
  totalWithFeeCents: number;
  depositCents: number;
  remainingCents: number;
  installmentCents: number;
  numInstallments: number;
  payments: ScheduledPayment[];
}

/**
 * Calculate a full payment schedule for a veterinary bill.
 *
 * @param billAmountCents - The vet bill in integer cents (minimum $500 / 50000 cents)
 * @param enrollmentDate - Date the plan starts (defaults to now)
 * @returns A complete PaymentSchedule with 7 payments (1 deposit + 6 installments)
 */
export function calculatePaymentSchedule(
  billAmountCents: number,
  enrollmentDate: Date = new Date(),
): PaymentSchedule {
  if (billAmountCents < MIN_BILL_CENTS) {
    throw new RangeError(
      `Bill amount ${billAmountCents} cents is below minimum ${MIN_BILL_CENTS} cents`,
    );
  }

  const feeCents = percentOfCents(billAmountCents, PLATFORM_FEE_RATE);
  const totalWithFeeCents = billAmountCents + feeCents;
  const depositCents = percentOfCents(totalWithFeeCents, DEPOSIT_RATE);
  const remainingCents = totalWithFeeCents - depositCents;
  const installmentCents = Math.floor(remainingCents / NUM_INSTALLMENTS);

  const payments: ScheduledPayment[] = [
    {
      type: 'deposit',
      sequenceNum: 0,
      amountCents: depositCents,
      scheduledAt: new Date(enrollmentDate),
    },
  ];

  for (let i = 1; i <= NUM_INSTALLMENTS; i++) {
    const scheduledAt = new Date(enrollmentDate);
    scheduledAt.setDate(scheduledAt.getDate() + i * 14);

    const isLast = i === NUM_INSTALLMENTS;
    const amountCents = isLast
      ? remainingCents - installmentCents * (NUM_INSTALLMENTS - 1)
      : installmentCents;

    payments.push({
      type: 'installment',
      sequenceNum: i,
      amountCents,
      scheduledAt,
    });
  }

  return {
    totalBillCents: billAmountCents,
    feeCents,
    totalWithFeeCents,
    depositCents,
    remainingCents,
    installmentCents,
    numInstallments: NUM_INSTALLMENTS,
    payments,
  };
}
