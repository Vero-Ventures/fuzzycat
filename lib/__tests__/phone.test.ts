import { describe, expect, it } from 'bun:test';
import { isValidUSPhone, normalizeUSPhone } from '@/lib/utils/phone';

// ── isValidUSPhone tests ────────────────────────────────────────────

describe('isValidUSPhone', () => {
  it('accepts valid US E.164 phone numbers', () => {
    expect(isValidUSPhone('+12125551234')).toBe(true);
    expect(isValidUSPhone('+13105551234')).toBe(true);
    expect(isValidUSPhone('+19175551234')).toBe(true);
  });

  it('rejects numbers without +1 prefix', () => {
    expect(isValidUSPhone('2125551234')).toBe(false);
    expect(isValidUSPhone('12125551234')).toBe(false);
  });

  it('rejects area codes starting with 0 or 1', () => {
    expect(isValidUSPhone('+10125551234')).toBe(false);
    expect(isValidUSPhone('+11125551234')).toBe(false);
  });

  it('rejects numbers that are too short', () => {
    expect(isValidUSPhone('+1212555123')).toBe(false);
    expect(isValidUSPhone('+1')).toBe(false);
  });

  it('rejects numbers that are too long', () => {
    expect(isValidUSPhone('+121255512345')).toBe(false);
  });

  it('rejects non-US international numbers', () => {
    expect(isValidUSPhone('+442071234567')).toBe(false);
    expect(isValidUSPhone('+33612345678')).toBe(false);
  });

  it('rejects empty and non-numeric strings', () => {
    expect(isValidUSPhone('')).toBe(false);
    expect(isValidUSPhone('not-a-phone')).toBe(false);
    expect(isValidUSPhone('+1abcdefghij')).toBe(false);
  });
});

// ── normalizeUSPhone tests ──────────────────────────────────────────

describe('normalizeUSPhone', () => {
  it('normalizes 10-digit numbers by prepending +1', () => {
    expect(normalizeUSPhone('2125551234')).toBe('+12125551234');
  });

  it('normalizes 11-digit numbers starting with 1 by prepending +', () => {
    expect(normalizeUSPhone('12125551234')).toBe('+12125551234');
  });

  it('passes through already-formatted E.164 numbers', () => {
    expect(normalizeUSPhone('+12125551234')).toBe('+12125551234');
  });

  it('strips parentheses, dashes, dots, and spaces', () => {
    expect(normalizeUSPhone('(212) 555-1234')).toBe('+12125551234');
    expect(normalizeUSPhone('212-555-1234')).toBe('+12125551234');
    expect(normalizeUSPhone('212.555.1234')).toBe('+12125551234');
    expect(normalizeUSPhone('212 555 1234')).toBe('+12125551234');
  });

  it('handles 1-prefixed formatted numbers', () => {
    expect(normalizeUSPhone('1 (212) 555-1234')).toBe('+12125551234');
    expect(normalizeUSPhone('1-212-555-1234')).toBe('+12125551234');
  });

  it('returns null for numbers that are too short', () => {
    expect(normalizeUSPhone('55512')).toBeNull();
    expect(normalizeUSPhone('')).toBeNull();
  });

  it('returns null for numbers that are too long', () => {
    expect(normalizeUSPhone('121255512345')).toBeNull();
  });

  it('returns null for non-US country codes', () => {
    // After stripping non-digits, +442071234567 becomes 442071234567 (12 digits) -> null
    expect(normalizeUSPhone('+442071234567')).toBeNull();
  });

  it('returns null when area code starts with 0 or 1', () => {
    expect(normalizeUSPhone('0125551234')).toBeNull();
    expect(normalizeUSPhone('1125551234')).toBeNull();
  });
});
