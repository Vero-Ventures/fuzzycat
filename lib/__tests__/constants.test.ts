import { describe, expect, it } from 'bun:test';
import {
  CLINIC_SHARE_RATE,
  DEPOSIT_RATE,
  MIN_BILL_CENTS,
  NUM_INSTALLMENTS,
  PLATFORM_FEE_RATE,
  PLATFORM_RESERVE_RATE,
} from '@/lib/constants';

describe('business constants', () => {
  it('platform fee rate is 6%', () => {
    expect(PLATFORM_FEE_RATE).toBe(0.06);
  });

  it('deposit rate is 25%', () => {
    expect(DEPOSIT_RATE).toBe(0.25);
  });

  it('clinic share rate is 3%', () => {
    expect(CLINIC_SHARE_RATE).toBe(0.03);
  });

  it('platform reserve rate is 1%', () => {
    expect(PLATFORM_RESERVE_RATE).toBe(0.01);
  });

  it('number of installments is 6', () => {
    expect(NUM_INSTALLMENTS).toBe(6);
  });

  it('minimum bill is $500 (50000 cents)', () => {
    expect(MIN_BILL_CENTS).toBe(50_000);
  });

  it('platform fee + clinic share + reserve < platform fee (FuzzyCat retains margin)', () => {
    // FuzzyCat charges 6% to owner, pays 3% to clinic, allocates 1% to platform reserve
    // Remaining ~2% is gross margin before processing costs
    expect(CLINIC_SHARE_RATE + PLATFORM_RESERVE_RATE).toBeLessThan(PLATFORM_FEE_RATE);
  });

  it('deposit + installments cover the full amount', () => {
    // For a $1,200 bill: fee=$72, total=$1,272, deposit=$318, remaining=$954, 6 installments of $159
    const billCents = 120_000;
    const feeCents = Math.round(billCents * PLATFORM_FEE_RATE);
    const totalWithFeeCents = billCents + feeCents;
    const depositCents = Math.round(totalWithFeeCents * DEPOSIT_RATE);
    const remainingCents = totalWithFeeCents - depositCents;
    const installmentCents = Math.round(remainingCents / NUM_INSTALLMENTS);

    // Total collected should be within rounding tolerance of the total with fee
    const totalCollected = depositCents + installmentCents * NUM_INSTALLMENTS;
    expect(Math.abs(totalCollected - totalWithFeeCents)).toBeLessThanOrEqual(NUM_INSTALLMENTS);
  });
});
