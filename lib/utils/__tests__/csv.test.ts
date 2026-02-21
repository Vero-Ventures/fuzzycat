import { describe, expect, it } from 'bun:test';
import { generateCsv } from '@/lib/utils/csv';

describe('generateCsv', () => {
  it('generates a simple CSV with headers and rows', () => {
    const csv = generateCsv(
      ['Name', 'Age', 'City'],
      [
        ['Alice', 30, 'Portland'],
        ['Bob', 25, 'Seattle'],
      ],
    );
    expect(csv).toBe('Name,Age,City\r\nAlice,30,Portland\r\nBob,25,Seattle');
  });

  it('escapes values containing commas', () => {
    const csv = generateCsv(['Name', 'Address'], [['John', '123 Main St, Suite 4']]);
    expect(csv).toBe('Name,Address\r\nJohn,"123 Main St, Suite 4"');
  });

  it('escapes values containing double quotes', () => {
    const csv = generateCsv(['Name', 'Nickname'], [['Jane', 'Jane "JJ" Smith']]);
    expect(csv).toBe('Name,Nickname\r\nJane,"Jane ""JJ"" Smith"');
  });

  it('escapes values containing newlines', () => {
    const csv = generateCsv(['Name', 'Notes'], [['Bob', 'Line 1\nLine 2']]);
    expect(csv).toBe('Name,Notes\r\nBob,"Line 1\nLine 2"');
  });

  it('escapes values containing carriage returns', () => {
    const csv = generateCsv(['Name', 'Notes'], [['Bob', 'Line 1\r\nLine 2']]);
    expect(csv).toBe('Name,Notes\r\nBob,"Line 1\r\nLine 2"');
  });

  it('handles empty values', () => {
    const csv = generateCsv(['A', 'B', 'C'], [['', '', '']]);
    expect(csv).toBe('A,B,C\r\n,,');
  });

  it('handles numeric values', () => {
    const csv = generateCsv(['Item', 'Price'], [['Widget', 1999]]);
    expect(csv).toBe('Item,Price\r\nWidget,1999');
  });

  it('handles zero values', () => {
    const csv = generateCsv(['Name', 'Balance'], [['Test', 0]]);
    expect(csv).toBe('Name,Balance\r\nTest,0');
  });

  it('handles headers only (no data rows)', () => {
    const csv = generateCsv(['A', 'B', 'C'], []);
    expect(csv).toBe('A,B,C');
  });

  it('escapes headers containing special characters', () => {
    const csv = generateCsv(['Name, First', 'Age'], [['Alice', 30]]);
    expect(csv).toBe('"Name, First",Age\r\nAlice,30');
  });

  it('handles combined edge cases in a single value', () => {
    const csv = generateCsv(['Data'], [['He said "hello, world"\nand left']]);
    expect(csv).toBe('Data\r\n"He said ""hello, world""\nand left"');
  });

  it('handles multiple rows', () => {
    const csv = generateCsv(
      ['ID', 'Name'],
      [
        [1, 'First'],
        [2, 'Second'],
        [3, 'Third'],
      ],
    );
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe('ID,Name');
    expect(lines[3]).toBe('3,Third');
  });
});
