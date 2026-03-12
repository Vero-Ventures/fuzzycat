import { describe, expect, it } from 'bun:test';
import { DEPOSIT_RATE, MIN_BILL_CENTS, NUM_INSTALLMENTS, PLATFORM_FEE_RATE } from '@/lib/constants';
import { addCents } from '@/lib/utils/money';
import { calculatePaymentSchedule } from '@/lib/utils/schedule';

const ENROLLMENT_DATE = new Date('2026-03-01T12:00:00Z');

describe('calculatePaymentSchedule', () => {
  describe('fee and deposit calculation', () => {
    it('calculates correctly for a $1,200 bill', () => {
      const schedule = calculatePaymentSchedule(120_000, ENROLLMENT_DATE);

      expect(schedule.totalBillCents).toBe(120_000);
      expect(schedule.feeCents).toBe(Math.round(120_000 * PLATFORM_FEE_RATE));
      expect(schedule.totalWithFeeCents).toBe(120_000 + schedule.feeCents);
      expect(schedule.depositCents).toBe(Math.round(schedule.totalWithFeeCents * DEPOSIT_RATE));
      expect(schedule.remainingCents).toBe(schedule.totalWithFeeCents - schedule.depositCents);
      expect(schedule.numInstallments).toBe(6);
    });

    it('calculates correctly for minimum $500 bill', () => {
      const schedule = calculatePaymentSchedule(50_000, ENROLLMENT_DATE);

      expect(schedule.totalBillCents).toBe(50_000);
      expect(schedule.feeCents).toBe(Math.round(50_000 * PLATFORM_FEE_RATE));
      expect(schedule.totalWithFeeCents).toBe(50_000 + schedule.feeCents);
      expect(schedule.depositCents).toBe(Math.round(schedule.totalWithFeeCents * DEPOSIT_RATE));
      expect(schedule.remainingCents).toBe(schedule.totalWithFeeCents - schedule.depositCents);
    });

    it('calculates correctly for a $10,000 bill', () => {
      const schedule = calculatePaymentSchedule(1_000_000, ENROLLMENT_DATE);

      expect(schedule.totalBillCents).toBe(1_000_000);
      expect(schedule.feeCents).toBe(Math.round(1_000_000 * PLATFORM_FEE_RATE));
      expect(schedule.totalWithFeeCents).toBe(1_000_000 + schedule.feeCents);
      expect(schedule.depositCents).toBe(Math.round(schedule.totalWithFeeCents * DEPOSIT_RATE));
      expect(schedule.remainingCents).toBe(schedule.totalWithFeeCents - schedule.depositCents);
    });
  });

  describe('installment rounding', () => {
    it('absorbs remainder into last installment for $775 bill', () => {
      const schedule = calculatePaymentSchedule(77_500, ENROLLMENT_DATE);
      const expectedFee = Math.round(77_500 * PLATFORM_FEE_RATE);
      const expectedTotal = 77_500 + expectedFee;
      const expectedDeposit = Math.round(expectedTotal * DEPOSIT_RATE);
      const expectedRemaining = expectedTotal - expectedDeposit;
      const expectedInstallment = Math.floor(expectedRemaining / NUM_INSTALLMENTS);
      const expectedLast = expectedRemaining - expectedInstallment * (NUM_INSTALLMENTS - 1);

      expect(schedule.installmentCents).toBe(expectedInstallment);

      const installments = schedule.payments.filter((p) => p.type === 'installment');
      const firstFive = installments.slice(0, 5);
      const last = installments[5];

      for (const p of firstFive) {
        expect(p.amountCents).toBe(expectedInstallment);
      }
      expect(last.amountCents).toBe(expectedLast);
    });

    it('all installments equal when evenly divisible', () => {
      const schedule = calculatePaymentSchedule(120_000, ENROLLMENT_DATE);

      const installments = schedule.payments.filter((p) => p.type === 'installment');
      // All installments should be the same when evenly divisible
      const baseAmount = installments[0].amountCents;
      for (const p of installments) {
        expect(p.amountCents).toBe(baseAmount);
      }
    });
  });

  describe('invariant: deposit + installments === totalWithFeeCents', () => {
    const billAmounts = [50_000, 75_000, 100_000, 120_000, 250_000, 500_000, 1_000_000];

    for (const billCents of billAmounts) {
      it(`holds for $${billCents / 100} bill`, () => {
        const schedule = calculatePaymentSchedule(billCents, ENROLLMENT_DATE);
        const installmentSum = schedule.payments
          .filter((p) => p.type === 'installment')
          .reduce((sum, p) => sum + p.amountCents, 0);

        expect(addCents(schedule.depositCents, installmentSum)).toBe(schedule.totalWithFeeCents);
      });
    }
  });

  describe('payment dates', () => {
    it('deposit is scheduled on enrollment date', () => {
      const schedule = calculatePaymentSchedule(120_000, ENROLLMENT_DATE);

      expect(schedule.payments[0].scheduledAt.getTime()).toBe(ENROLLMENT_DATE.getTime());
    });

    it('installments are 14 days apart', () => {
      const schedule = calculatePaymentSchedule(120_000, ENROLLMENT_DATE);
      const installments = schedule.payments.filter((p) => p.type === 'installment');

      for (let i = 0; i < installments.length; i++) {
        const expectedDate = new Date(ENROLLMENT_DATE);
        expectedDate.setDate(expectedDate.getDate() + (i + 1) * 14);
        expect(installments[i].scheduledAt.getTime()).toBe(expectedDate.getTime());
      }
    });

    it('last installment is at 84 days (12 weeks)', () => {
      const schedule = calculatePaymentSchedule(120_000, ENROLLMENT_DATE);
      const lastPayment = schedule.payments[schedule.payments.length - 1];

      const expectedDate = new Date(ENROLLMENT_DATE);
      expectedDate.setDate(expectedDate.getDate() + 84);
      expect(lastPayment.scheduledAt.getTime()).toBe(expectedDate.getTime());
    });
  });

  describe('payments array structure', () => {
    it('contains exactly 7 payments', () => {
      const schedule = calculatePaymentSchedule(120_000, ENROLLMENT_DATE);
      expect(schedule.payments).toHaveLength(7);
    });

    it('first payment is a deposit with sequenceNum 0', () => {
      const schedule = calculatePaymentSchedule(120_000, ENROLLMENT_DATE);
      const deposit = schedule.payments[0];

      expect(deposit.type).toBe('deposit');
      expect(deposit.sequenceNum).toBe(0);
      expect(deposit.amountCents).toBe(schedule.depositCents);
    });

    it('installments have sequenceNum 1 through 6', () => {
      const schedule = calculatePaymentSchedule(120_000, ENROLLMENT_DATE);
      const installments = schedule.payments.filter((p) => p.type === 'installment');

      expect(installments).toHaveLength(NUM_INSTALLMENTS);
      for (let i = 0; i < installments.length; i++) {
        expect(installments[i].sequenceNum).toBe(i + 1);
      }
    });
  });

  describe('validation', () => {
    it('rejects bills below minimum ($500)', () => {
      expect(() => calculatePaymentSchedule(49_999)).toThrow(RangeError);
    });

    it('rejects zero', () => {
      expect(() => calculatePaymentSchedule(0)).toThrow(RangeError);
    });

    it('rejects negative amounts', () => {
      expect(() => calculatePaymentSchedule(-50_000)).toThrow(RangeError);
    });

    it('accepts exactly the minimum', () => {
      expect(() => calculatePaymentSchedule(MIN_BILL_CENTS)).not.toThrow();
    });
  });

  describe('defaults', () => {
    it('uses current date when enrollmentDate is omitted', () => {
      const before = Date.now();
      const schedule = calculatePaymentSchedule(120_000);
      const after = Date.now();

      const depositTime = schedule.payments[0].scheduledAt.getTime();
      expect(depositTime).toBeGreaterThanOrEqual(before);
      expect(depositTime).toBeLessThanOrEqual(after);
    });
  });
});
