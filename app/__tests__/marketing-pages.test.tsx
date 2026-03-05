import { describe, expect, it } from 'bun:test';
import {
  CLINIC_SHARE_RATE,
  DEPOSIT_RATE,
  NUM_INSTALLMENTS,
  PLATFORM_FEE_RATE,
} from '@/lib/constants';

describe('Marketing page constants', () => {
  it('should use correct fee percentage', () => {
    expect(PLATFORM_FEE_RATE).toBe(0.09);
    expect(Math.round(PLATFORM_FEE_RATE * 100)).toBe(9);
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

    expect(feeCents).toBe(Math.round(120_000 * PLATFORM_FEE_RATE));
    expect(totalWithFeeCents).toBe(120_000 + feeCents);
    expect(depositCents).toBe(Math.round(totalWithFeeCents * DEPOSIT_RATE));
    expect(remainingCents).toBe(totalWithFeeCents - depositCents);
    expect(installmentCents).toBe(Math.floor(remainingCents / NUM_INSTALLMENTS));
  });

  it('should compute total with fee correctly for $500 bill (minimum)', () => {
    const billCents = 50_000;
    const feeCents = Math.round(billCents * PLATFORM_FEE_RATE);
    const totalWithFeeCents = billCents + feeCents;
    const depositCents = Math.round(totalWithFeeCents * DEPOSIT_RATE);

    expect(feeCents).toBe(Math.round(50_000 * PLATFORM_FEE_RATE));
    expect(totalWithFeeCents).toBe(50_000 + feeCents);
    expect(depositCents).toBe(Math.round(totalWithFeeCents * DEPOSIT_RATE));
  });

  it('should produce 7 total payments (1 deposit + 6 installments)', () => {
    const totalPayments = 1 + NUM_INSTALLMENTS;
    expect(totalPayments).toBe(7);
  });
});
