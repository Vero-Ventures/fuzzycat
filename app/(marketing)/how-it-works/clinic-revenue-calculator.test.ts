import { describe, expect, test } from 'bun:test';
import { CLINIC_SHARE_RATE } from '@/lib/constants';
import { calculateClinicRevenue } from './clinic-revenue-calculator';

describe('calculateClinicRevenue', () => {
  test('calculates with default values', () => {
    const result = calculateClinicRevenue(10, 1200);

    // lostRevenue = 10 * $1,200 = $12,000 = 1_200_000 cents
    expect(result.lostRevenueMonthlyCents).toBe(1_200_000);
    expect(result.lostRevenueAnnualCents).toBe(1_200_000 * 12);

    // recaptured = $12,000 * 0.40 = $4,800 = 480_000 cents
    expect(result.recapturedMonthlyCents).toBe(480_000);
    expect(result.recapturedAnnualCents).toBe(480_000 * 12);

    // revenueShare = $4,800 * 0.03 = $144 = 14_400 cents
    expect(result.revenueShareMonthlyCents).toBe(Math.round(480_000 * CLINIC_SHARE_RATE));
    expect(result.revenueShareAnnualCents).toBe(result.revenueShareMonthlyCents * 12);

    // bnplFee = $4,800 * 0.10 = $480 = 48_000 cents
    expect(result.bnplFeeMonthlyCents).toBe(48_000);
    expect(result.bnplFeeAnnualCents).toBe(48_000 * 12);
  });

  test('calculates with minimum slider values', () => {
    const result = calculateClinicRevenue(1, 500);

    // lostRevenue = 1 * $500 = $500 = 50_000 cents
    expect(result.lostRevenueMonthlyCents).toBe(50_000);

    // recaptured = $500 * 0.40 = $200 = 20_000 cents
    expect(result.recapturedMonthlyCents).toBe(20_000);

    // revenueShare = $200 * 0.03 = $6 = 600 cents
    expect(result.revenueShareMonthlyCents).toBe(600);
  });

  test('calculates with maximum slider values', () => {
    const result = calculateClinicRevenue(50, 5000);

    // lostRevenue = 50 * $5,000 = $250,000 = 25_000_000 cents
    expect(result.lostRevenueMonthlyCents).toBe(25_000_000);

    // recaptured = $250,000 * 0.40 = $100,000 = 10_000_000 cents
    expect(result.recapturedMonthlyCents).toBe(10_000_000);

    // revenueShare = $100,000 * 0.03 = $3,000 = 300_000 cents
    expect(result.revenueShareMonthlyCents).toBe(300_000);
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
