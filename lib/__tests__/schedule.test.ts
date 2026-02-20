import { describe, expect, it } from 'bun:test';
import { MIN_BILL_CENTS, NUM_INSTALLMENTS } from '@/lib/constants';
import { addCents } from '@/lib/utils/money';
import { calculatePaymentSchedule } from '@/lib/utils/schedule';

const ENROLLMENT_DATE = new Date('2026-03-01T12:00:00Z');

describe('calculatePaymentSchedule', () => {
  describe('fee and deposit calculation', () => {
    it('calculates correctly for a $1,200 bill', () => {
      const schedule = calculatePaymentSchedule(120_000, ENROLLMENT_DATE);

      expect(schedule.totalBillCents).toBe(120_000);
      expect(schedule.feeCents).toBe(7_200); // 6% of $1,200
      expect(schedule.totalWithFeeCents).toBe(127_200);
      expect(schedule.depositCents).toBe(31_800); // 25% of $1,272
      expect(schedule.remainingCents).toBe(95_400);
      expect(schedule.numInstallments).toBe(6);
    });

    it('calculates correctly for minimum $500 bill', () => {
      const schedule = calculatePaymentSchedule(50_000, ENROLLMENT_DATE);

      expect(schedule.totalBillCents).toBe(50_000);
      expect(schedule.feeCents).toBe(3_000); // 6% of $500
      expect(schedule.totalWithFeeCents).toBe(53_000);
      expect(schedule.depositCents).toBe(13_250); // 25% of $530
      expect(schedule.remainingCents).toBe(39_750);
    });

    it('calculates correctly for a $10,000 bill', () => {
      const schedule = calculatePaymentSchedule(1_000_000, ENROLLMENT_DATE);

      expect(schedule.totalBillCents).toBe(1_000_000);
      expect(schedule.feeCents).toBe(60_000); // 6% of $10,000
      expect(schedule.totalWithFeeCents).toBe(1_060_000);
      expect(schedule.depositCents).toBe(265_000); // 25% of $10,600
      expect(schedule.remainingCents).toBe(795_000);
    });
  });

  describe('installment rounding', () => {
    it('absorbs remainder into last installment for $750 bill', () => {
      const schedule = calculatePaymentSchedule(75_000, ENROLLMENT_DATE);
      // fee = 4500, total = 79500, deposit = 19875, remaining = 59625
      // floor(59625 / 6) = 9937 per installment
      // last = 59625 - 9937 * 5 = 59625 - 49685 = 9940

      expect(schedule.installmentCents).toBe(9937);

      const installments = schedule.payments.filter((p) => p.type === 'installment');
      const firstFive = installments.slice(0, 5);
      const last = installments[5];

      for (const p of firstFive) {
        expect(p.amountCents).toBe(9937);
      }
      expect(last.amountCents).toBe(9940);
    });

    it('all installments equal when evenly divisible', () => {
      const schedule = calculatePaymentSchedule(120_000, ENROLLMENT_DATE);
      // remaining = 95400, 95400 / 6 = 15900 exactly

      const installments = schedule.payments.filter((p) => p.type === 'installment');
      for (const p of installments) {
        expect(p.amountCents).toBe(15_900);
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
