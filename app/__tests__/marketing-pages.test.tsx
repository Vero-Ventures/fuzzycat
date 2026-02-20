import { describe, expect, it } from 'bun:test';
import {
  CLINIC_SHARE_RATE,
  DEPOSIT_RATE,
  NUM_INSTALLMENTS,
  PLATFORM_FEE_RATE,
} from '@/lib/constants';

describe('Marketing page constants', () => {
  it('should use correct fee percentage', () => {
    expect(PLATFORM_FEE_RATE).toBe(0.06);
    expect(Math.round(PLATFORM_FEE_RATE * 100)).toBe(6);
  });

  it('should use correct deposit percentage', () => {
    expect(DEPOSIT_RATE).toBe(0.25);
    expect(Math.round(DEPOSIT_RATE * 100)).toBe(25);
  });

  it('should use correct number of installments', () => {
    expect(NUM_INSTALLMENTS).toBe(6);
  });

  it('should use correct clinic share percentage', () => {
    expect(CLINIC_SHARE_RATE).toBe(0.03);
    expect(Math.round(CLINIC_SHARE_RATE * 100)).toBe(3);
  });
});

describe('Payment calculator display logic', () => {
  it('should compute total with fee correctly for $1200 bill', () => {
    const billCents = 120_000;
    const feeCents = Math.round(billCents * PLATFORM_FEE_RATE);
    const totalWithFeeCents = billCents + feeCents;
    const depositCents = Math.round(totalWithFeeCents * DEPOSIT_RATE);
    const remainingCents = totalWithFeeCents - depositCents;
    const installmentCents = Math.floor(remainingCents / NUM_INSTALLMENTS);

    expect(feeCents).toBe(7200); // $72
    expect(totalWithFeeCents).toBe(127_200); // $1,272
    expect(depositCents).toBe(31_800); // $318
    expect(remainingCents).toBe(95_400); // $954
    expect(installmentCents).toBe(15_900); // $159
  });

  it('should compute total with fee correctly for $500 bill (minimum)', () => {
    const billCents = 50_000;
    const feeCents = Math.round(billCents * PLATFORM_FEE_RATE);
    const totalWithFeeCents = billCents + feeCents;
    const depositCents = Math.round(totalWithFeeCents * DEPOSIT_RATE);

    expect(feeCents).toBe(3000); // $30
    expect(totalWithFeeCents).toBe(53_000); // $530
    expect(depositCents).toBe(13_250); // $132.50
  });

  it('should produce 7 total payments (1 deposit + 6 installments)', () => {
    const totalPayments = 1 + NUM_INSTALLMENTS;
    expect(totalPayments).toBe(7);
  });
});
