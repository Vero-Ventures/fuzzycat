import { describe, expect, test } from 'bun:test';
import { CLINIC_SHARE_RATE } from '@/lib/constants';
import { calculateClinicRevenue } from './clinic-revenue-calculator';

describe('calculateClinicRevenue', () => {
  test('calculates with default values', () => {
    const result = calculateClinicRevenue(1200, 80, 20, 40);

    // lostRevenue = $1,200 * 80 * 0.20 = $19,200 = 1_920_000 cents
    expect(result.lostRevenueMonthlyCents).toBe(1_920_000);
    expect(result.lostRevenueAnnualCents).toBe(1_920_000 * 12);

    // recaptured = $19,200 * 0.40 = $7,680 = 768_000 cents
    expect(result.recapturedMonthlyCents).toBe(768_000);
    expect(result.recapturedAnnualCents).toBe(768_000 * 12);

    // revenueShare = $7,680 * 0.03 = $230.40 = 23_040 cents
    expect(result.revenueShareMonthlyCents).toBe(Math.round(768_000 * CLINIC_SHARE_RATE));
    expect(result.revenueShareAnnualCents).toBe(result.revenueShareMonthlyCents * 12);

    // bnplFee = $7,680 * 0.10 = $768 = 76_800 cents
    expect(result.bnplFeeMonthlyCents).toBe(76_800);
    expect(result.bnplFeeAnnualCents).toBe(76_800 * 12);
  });

  test('calculates with minimum slider values', () => {
    const result = calculateClinicRevenue(500, 10, 5, 20);

    // lostRevenue = $500 * 10 * 0.05 = $250 = 25_000 cents
    expect(result.lostRevenueMonthlyCents).toBe(25_000);

    // recaptured = $250 * 0.20 = $50 = 5_000 cents
    expect(result.recapturedMonthlyCents).toBe(5_000);

    // revenueShare = $50 * 0.03 = $1.50 = 150 cents
    expect(result.revenueShareMonthlyCents).toBe(150);
  });

  test('calculates with maximum slider values', () => {
    const result = calculateClinicRevenue(5000, 200, 40, 80);

    // lostRevenue = $5,000 * 200 * 0.40 = $400,000 = 40_000_000 cents
    expect(result.lostRevenueMonthlyCents).toBe(40_000_000);

    // recaptured = $400,000 * 0.80 = $320,000 = 32_000_000 cents
    expect(result.recapturedMonthlyCents).toBe(32_000_000);

    // revenueShare = $320,000 * 0.03 = $9,600 = 960_000 cents
    expect(result.revenueShareMonthlyCents).toBe(960_000);
  });

  test('annual values are 12x monthly', () => {
    const result = calculateClinicRevenue(2000, 50, 15, 60);

    expect(result.lostRevenueAnnualCents).toBe(result.lostRevenueMonthlyCents * 12);
    expect(result.recapturedAnnualCents).toBe(result.recapturedMonthlyCents * 12);
    expect(result.revenueShareAnnualCents).toBe(result.revenueShareMonthlyCents * 12);
    expect(result.bnplFeeAnnualCents).toBe(result.bnplFeeMonthlyCents * 12);
  });

  test('all monetary values are integers (cents)', () => {
    const result = calculateClinicRevenue(1337, 73, 17, 33);

    expect(Number.isInteger(result.lostRevenueMonthlyCents)).toBe(true);
    expect(Number.isInteger(result.recapturedMonthlyCents)).toBe(true);
    expect(Number.isInteger(result.revenueShareMonthlyCents)).toBe(true);
    expect(Number.isInteger(result.bnplFeeMonthlyCents)).toBe(true);
    expect(Number.isInteger(result.lostRevenueAnnualCents)).toBe(true);
    expect(Number.isInteger(result.recapturedAnnualCents)).toBe(true);
    expect(Number.isInteger(result.revenueShareAnnualCents)).toBe(true);
    expect(Number.isInteger(result.bnplFeeAnnualCents)).toBe(true);
  });

  test('zero decline rate means zero everything', () => {
    // declineRate min is 5% in UI, but the function should handle edge cases
    const result = calculateClinicRevenue(1200, 80, 0, 40);

    expect(result.lostRevenueMonthlyCents).toBe(0);
    expect(result.recapturedMonthlyCents).toBe(0);
    expect(result.revenueShareMonthlyCents).toBe(0);
    expect(result.bnplFeeMonthlyCents).toBe(0);
  });

  test('zero conversion rate means zero recaptured but nonzero lost', () => {
    const result = calculateClinicRevenue(1200, 80, 20, 0);

    expect(result.lostRevenueMonthlyCents).toBe(1_920_000);
    expect(result.recapturedMonthlyCents).toBe(0);
    expect(result.revenueShareMonthlyCents).toBe(0);
    expect(result.bnplFeeMonthlyCents).toBe(0);
  });
});
