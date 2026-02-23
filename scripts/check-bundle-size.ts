/**
 * CI lint: enforce client-side JS bundle size budget.
 *
 * Measures the total gzipped size of all JS chunks in .next/static/chunks/
 * and fails if it exceeds the budget. Run after `next build`.
 *
 * Usage: bun run scripts/check-bundle-size.ts
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = join(import.meta.dir, '..');
const CHUNKS_DIR = join(ROOT, '.next', 'static', 'chunks');

/** Maximum allowed total gzipped size of client JS in kilobytes. */
const BUDGET_KB = 750;

function collectJsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsFiles(full));
    } else if (entry.name.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

if (!existsSync(CHUNKS_DIR)) {
  console.error(`ERROR: ${CHUNKS_DIR} not found. Run 'bun run build' first.`);
  process.exit(1);
}

const jsFiles = collectJsFiles(CHUNKS_DIR);
let totalGzipBytes = 0;

for (const file of jsFiles) {
  const raw = readFileSync(file);
  const gzipped = gzipSync(raw);
  totalGzipBytes += gzipped.length;
}

const totalKB = Math.round(totalGzipBytes / 1024);
const budgetBytes = BUDGET_KB * 1024;

console.log('Bundle size check:');
console.log(`  Files:  ${jsFiles.length} JS chunks`);
console.log(`  Total:  ${totalKB} kB gzipped`);
console.log(`  Budget: ${BUDGET_KB} kB gzipped`);
console.log();

if (totalGzipBytes > budgetBytes) {
  console.error(`FAIL: Bundle size ${totalKB} kB exceeds budget of ${BUDGET_KB} kB`);
  process.exit(1);
} else {
  console.log('PASS: Bundle size is within budget.');
}
