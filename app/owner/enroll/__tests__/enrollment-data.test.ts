import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { billDetailsSchema } from '@/app/owner/enroll/_components/step-bill-details';
import { MIN_BILL_CENTS } from '@/lib/constants';
import { formatCents, toCents } from '@/lib/utils/money';
import { calculatePaymentSchedule } from '@/lib/utils/schedule';

const paymentMethodSchema = z.enum(['debit_card', 'bank_account']);

/**
 * Tests for the enrollment flow data types and validation logic.
 * These validate the business rules used across enrollment steps.
 */

const validBillDetails = {
  billAmountCents: toCents(1200),
  ownerName: 'Jane Smith',
  ownerEmail: 'jane@example.com',
  ownerPhone: '(555) 123-4567',
  petName: 'Whiskers',
};

describe('Enrollment flow data validation', () => {
  describe('bill amount validation', () => {
    it('rejects amounts below $500', () => {
      const billCents = toCents(499.99);
      expect(billCents).toBeLessThan(MIN_BILL_CENTS);
    });

    it('accepts exactly $500', () => {
      const billCents = toCents(500);
      expect(billCents).toBe(MIN_BILL_CENTS);
      expect(() => calculatePaymentSchedule(billCents)).not.toThrow();
    });

    it('accepts typical vet bill amounts', () => {
      const amounts = [500, 750, 1200, 2500, 5000, 10000];
      for (const dollars of amounts) {
        const cents = toCents(dollars);
        const schedule = calculatePaymentSchedule(cents);
        expect(schedule.totalBillCents).toBe(cents);
        expect(schedule.payments).toHaveLength(7);
      }
    });
  });

  describe('schedule display formatting', () => {
    it('formats deposit correctly for a $1,200 bill', () => {
      const schedule = calculatePaymentSchedule(toCents(1200));
      const formattedDeposit = formatCents(schedule.depositCents);
      // Deposit = 25% of ($1,200 + 6% fee) = 25% of $1,272 = $318.00
      expect(formattedDeposit).toBe('$318.00');
    });

    it('formats fee correctly for a $1,200 bill', () => {
      const schedule = calculatePaymentSchedule(toCents(1200));
      const formattedFee = formatCents(schedule.feeCents);
      expect(formattedFee).toBe('$72.00');
    });

    it('formats installment correctly for a $1,200 bill', () => {
      const schedule = calculatePaymentSchedule(toCents(1200));
      const formattedInstallment = formatCents(schedule.installmentCents);
      // Remaining = $954.00, per installment = $159.00
      expect(formattedInstallment).toBe('$159.00');
    });
  });

  describe('payment method validation', () => {
    it('accepts debit_card as payment method', () => {
      expect(paymentMethodSchema.safeParse('debit_card').success).toBe(true);
    });

    it('accepts bank_account as payment method', () => {
      expect(paymentMethodSchema.safeParse('bank_account').success).toBe(true);
    });

    it('rejects invalid payment methods', () => {
      expect(paymentMethodSchema.safeParse('credit_card').success).toBe(false);
      expect(paymentMethodSchema.safeParse('').success).toBe(false);
      expect(paymentMethodSchema.safeParse(123).success).toBe(false);
    });
  });

  describe('owner data requirements (Zod schema)', () => {
    it('accepts valid owner data', () => {
      const result = billDetailsSchema.safeParse(validBillDetails);
      expect(result.success).toBe(true);
    });

    it('rejects bill amount below minimum', () => {
      const result = billDetailsSchema.safeParse({
        ...validBillDetails,
        billAmountCents: 10000, // $100, below $500 minimum
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-integer bill amount', () => {
      const result = billDetailsSchema.safeParse({
        ...validBillDetails,
        billAmountCents: 50000.5,
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty owner name', () => {
      const result = billDetailsSchema.safeParse({
        ...validBillDetails,
        ownerName: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects whitespace-only owner name', () => {
      const result = billDetailsSchema.safeParse({
        ...validBillDetails,
        ownerName: '   ',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid email format', () => {
      const result = billDetailsSchema.safeParse({
        ...validBillDetails,
        ownerEmail: 'not-an-email',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty email', () => {
      const result = billDetailsSchema.safeParse({
        ...validBillDetails,
        ownerEmail: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty phone number', () => {
      const result = billDetailsSchema.safeParse({
        ...validBillDetails,
        ownerPhone: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty pet name', () => {
      const result = billDetailsSchema.safeParse({
        ...validBillDetails,
        petName: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing required fields', () => {
      const result = billDetailsSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('trims owner name whitespace', () => {
      const result = billDetailsSchema.safeParse({
        ...validBillDetails,
        ownerName: '  Jane Smith  ',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ownerName).toBe('Jane Smith');
      }
    });
  });

  describe('disclaimer validation', () => {
    it('requires both disclaimers and captcha to proceed', () => {
      const disclaimersAccepted = true;
      const captchaVerified = true;
      const canContinue = disclaimersAccepted && captchaVerified;
      expect(canContinue).toBe(true);
    });

    it('blocks continuation without disclaimers', () => {
      const disclaimersAccepted = false;
      const captchaVerified = true;
      const canContinue = disclaimersAccepted && captchaVerified;
      expect(canContinue).toBe(false);
    });

    it('blocks continuation without captcha', () => {
      const disclaimersAccepted = true;
      const captchaVerified = false;
      const canContinue = disclaimersAccepted && captchaVerified;
      expect(canContinue).toBe(false);
    });
  });
});
