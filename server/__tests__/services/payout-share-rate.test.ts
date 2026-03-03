import { describe, expect, it } from 'bun:test';

import { DEFAULT_CLINIC_SHARE_BPS, FOUNDING_CLINIC_SHARE_BPS } from '@/lib/constants';
import { getEffectiveShareRate } from '@/server/services/payout';

// ── getEffectiveShareRate ────────────────────────────────────────────
// Pure function — no mocking needed.

describe('getEffectiveShareRate', () => {
  const defaultRate = DEFAULT_CLINIC_SHARE_BPS / 10_000; // 0.03
  const foundingRate = FOUNDING_CLINIC_SHARE_BPS / 10_000; // 0.05

  it('returns default rate for a non-founding clinic', () => {
    const rate = getEffectiveShareRate({
      revenueShareBps: DEFAULT_CLINIC_SHARE_BPS,
      foundingClinic: false,
      foundingExpiresAt: null,
    });
    expect(rate).toBe(defaultRate);
  });

  it('returns default rate when foundingClinic is true but expiresAt is null', () => {
    const rate = getEffectiveShareRate({
      revenueShareBps: FOUNDING_CLINIC_SHARE_BPS,
      foundingClinic: true,
      foundingExpiresAt: null,
    });
    expect(rate).toBe(defaultRate);
  });

  it('returns default rate when foundingClinic is true but expiresAt is in the past', () => {
    const pastDate = new Date('2020-01-01');
    const rate = getEffectiveShareRate({
      revenueShareBps: FOUNDING_CLINIC_SHARE_BPS,
      foundingClinic: true,
      foundingExpiresAt: pastDate,
    });
    expect(rate).toBe(defaultRate);
  });

  it('returns enhanced rate for founding clinic with future expiry', () => {
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const rate = getEffectiveShareRate({
      revenueShareBps: FOUNDING_CLINIC_SHARE_BPS,
      foundingClinic: true,
      foundingExpiresAt: futureDate,
    });
    expect(rate).toBe(foundingRate);
  });

  it('returns custom BPS rate for founding clinic with future expiry', () => {
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const customBps = 700; // 7%
    const rate = getEffectiveShareRate({
      revenueShareBps: customBps,
      foundingClinic: true,
      foundingExpiresAt: futureDate,
    });
    expect(rate).toBe(0.07);
  });

  it('returns default rate when foundingClinic is false even with future expiry', () => {
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const rate = getEffectiveShareRate({
      revenueShareBps: FOUNDING_CLINIC_SHARE_BPS,
      foundingClinic: false,
      foundingExpiresAt: futureDate,
    });
    expect(rate).toBe(defaultRate);
  });

  it('returns default rate when expiry is exactly now (edge: not strictly greater)', () => {
    // new Date() inside the function will be >= the value we set here,
    // so the condition clinic.foundingExpiresAt > new Date() will be false.
    const now = new Date();
    const rate = getEffectiveShareRate({
      revenueShareBps: FOUNDING_CLINIC_SHARE_BPS,
      foundingClinic: true,
      foundingExpiresAt: now,
    });
    // At best the dates are equal, so > fails → default rate
    expect(rate).toBe(defaultRate);
  });
});
