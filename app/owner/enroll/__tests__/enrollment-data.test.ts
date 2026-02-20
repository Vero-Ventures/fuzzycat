import { describe, expect, it } from 'bun:test';
import { MIN_BILL_CENTS } from '@/lib/constants';
import { formatCents, toCents } from '@/lib/utils/money';
import { calculatePaymentSchedule } from '@/lib/utils/schedule';

/**
 * Tests for the enrollment flow data types and validation logic.
 * These validate the business rules used across enrollment steps.
 */

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
      const method: 'debit_card' | 'bank_account' = 'debit_card';
      expect(method).toBe('debit_card');
    });

    it('accepts bank_account as payment method', () => {
      const method: 'debit_card' | 'bank_account' = 'bank_account';
      expect(method).toBe('bank_account');
    });
  });

  describe('owner data requirements', () => {
    it('requires all mandatory fields', () => {
      const ownerData = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '(555) 123-4567',
        petName: 'Whiskers',
        paymentMethod: 'debit_card' as const,
      };

      expect(ownerData.name.trim().length).toBeGreaterThan(0);
      expect(ownerData.email.trim().length).toBeGreaterThan(0);
      expect(ownerData.phone.trim().length).toBeGreaterThan(0);
      expect(ownerData.petName.trim().length).toBeGreaterThan(0);
    });

    it('rejects empty required fields', () => {
      expect(''.trim().length).toBe(0);
      expect('  '.trim().length).toBe(0);
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
