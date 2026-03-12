import { describe, expect, test } from 'bun:test';
import { CLINIC_SHARE_RATE } from '@/lib/constants';
import { percentOfCents } from '@/lib/utils/money';
import {
  calculateClinicRevenue,
  PAYMENT_PLAN_CONVERSION_RATE,
  TYPICAL_BNPL_MERCHANT_FEE_RATE,
} from './clinic-revenue-calculator';

describe('calculateClinicRevenue', () => {
  test('calculates with default values', () => {
    const result = calculateClinicRevenue(10, 1200);

    const expectedLost = Math.round(1200 * 100 * 10);
    const expectedRecaptured = Math.round(expectedLost * PAYMENT_PLAN_CONVERSION_RATE);

    expect(result.lostRevenueMonthlyCents).toBe(expectedLost);
    expect(result.lostRevenueAnnualCents).toBe(expectedLost * 12);

    expect(result.recapturedMonthlyCents).toBe(expectedRecaptured);
    expect(result.recapturedAnnualCents).toBe(expectedRecaptured * 12);

    expect(result.revenueShareMonthlyCents).toBe(
      percentOfCents(expectedRecaptured, CLINIC_SHARE_RATE),
    );
    expect(result.revenueShareAnnualCents).toBe(result.revenueShareMonthlyCents * 12);

    expect(result.bnplFeeMonthlyCents).toBe(
      percentOfCents(expectedRecaptured, TYPICAL_BNPL_MERCHANT_FEE_RATE),
    );
    expect(result.bnplFeeAnnualCents).toBe(result.bnplFeeMonthlyCents * 12);
  });

  test('calculates with minimum slider values', () => {
    const result = calculateClinicRevenue(1, 500);

    const expectedLost = Math.round(500 * 100 * 1);
    const expectedRecaptured = Math.round(expectedLost * PAYMENT_PLAN_CONVERSION_RATE);

    expect(result.lostRevenueMonthlyCents).toBe(expectedLost);
    expect(result.recapturedMonthlyCents).toBe(expectedRecaptured);
    expect(result.revenueShareMonthlyCents).toBe(
      percentOfCents(expectedRecaptured, CLINIC_SHARE_RATE),
    );
  });

  test('calculates with maximum slider values', () => {
    const result = calculateClinicRevenue(50, 5000);

    const expectedLost = Math.round(5000 * 100 * 50);
    const expectedRecaptured = Math.round(expectedLost * PAYMENT_PLAN_CONVERSION_RATE);

    expect(result.lostRevenueMonthlyCents).toBe(expectedLost);
    expect(result.recapturedMonthlyCents).toBe(expectedRecaptured);
    expect(result.revenueShareMonthlyCents).toBe(
      percentOfCents(expectedRecaptured, CLINIC_SHARE_RATE),
    );
  });

  test('annual values are 12x monthly', () => {
    const result = calculateClinicRevenue(15, 2000);

    expect(result.lostRevenueAnnualCents).toBe(result.lostRevenueMonthlyCents * 12);
    expect(result.recapturedAnnualCents).toBe(result.recapturedMonthlyCents * 12);
    expect(result.revenueShareAnnualCents).toBe(result.revenueShareMonthlyCents * 12);
    expect(result.bnplFeeAnnualCents).toBe(result.bnplFeeMonthlyCents * 12);
  });

  test('all monetary values are integers (cents)', () => {
    const result = calculateClinicRevenue(13, 1337);

    expect(Number.isInteger(result.lostRevenueMonthlyCents)).toBe(true);
    expect(Number.isInteger(result.recapturedMonthlyCents)).toBe(true);
    expect(Number.isInteger(result.revenueShareMonthlyCents)).toBe(true);
    expect(Number.isInteger(result.bnplFeeMonthlyCents)).toBe(true);
    expect(Number.isInteger(result.lostRevenueAnnualCents)).toBe(true);
    expect(Number.isInteger(result.recapturedAnnualCents)).toBe(true);
    expect(Number.isInteger(result.revenueShareAnnualCents)).toBe(true);
    expect(Number.isInteger(result.bnplFeeAnnualCents)).toBe(true);
  });

  test('zero declined clients means zero everything', () => {
    const result = calculateClinicRevenue(0, 1200);

    expect(result.lostRevenueMonthlyCents).toBe(0);
    expect(result.recapturedMonthlyCents).toBe(0);
    expect(result.revenueShareMonthlyCents).toBe(0);
    expect(result.bnplFeeMonthlyCents).toBe(0);
  });
});
