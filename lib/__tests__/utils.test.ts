import { describe, expect, it } from 'bun:test';
import { cn } from '@/lib/utils';

describe('cn (classname utility)', () => {
  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns a single class name', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('merges multiple class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('handles undefined and null values', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
  });

  it('merges Tailwind classes correctly (last wins)', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });

  it('merges conflicting Tailwind classes', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('handles array inputs', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('handles object inputs', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
  });
});
