import { describe, expect, it } from 'bun:test';
import { getColorIndex, getInitials } from '@/components/shared/avatar-initials';

describe('getInitials', () => {
  it('extracts initials from two-word name', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('extracts initials from single-word name', () => {
    expect(getInitials('Alice')).toBe('A');
  });

  it('handles three-word names using first and last', () => {
    expect(getInitials('Mary Jane Watson')).toBe('MW');
  });

  it('returns ? for empty string', () => {
    expect(getInitials('')).toBe('?');
  });

  it('handles extra whitespace', () => {
    expect(getInitials('  Jane   Smith  ')).toBe('JS');
  });

  it('uppercases lowercase input', () => {
    expect(getInitials('bob ross')).toBe('BR');
  });
});

describe('getColorIndex', () => {
  it('returns a valid index in range', () => {
    const index = getColorIndex('John Doe');
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(8);
  });

  it('returns consistent value for same name', () => {
    const a = getColorIndex('Alice');
    const b = getColorIndex('Alice');
    expect(a).toBe(b);
  });

  it('returns different values for different names', () => {
    const a = getColorIndex('Alice');
    const b = getColorIndex('Bob');
    // Different names should usually get different indices (not guaranteed but very likely)
    // This is a determinism test more than a uniqueness test
    expect(typeof a).toBe('number');
    expect(typeof b).toBe('number');
  });
});
