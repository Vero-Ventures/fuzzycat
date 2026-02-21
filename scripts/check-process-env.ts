/**
 * CI lint: detect direct `process.env.` access in non-exempt source files.
 *
 * All env var access should go through the Zod-validated `serverEnv()` or
 * `publicEnv()` helpers in `lib/env.ts`. This script ensures developers
 * don't accidentally bypass validation.
 *
 * Usage: bun run scripts/check-process-env.ts
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dir, '..');

// Files/directories exempt from this check
const EXEMPT_PATTERNS = [
  'node_modules',
  '.next',
  'sentry.client.config.ts',
  'sentry.server.config.ts',
  'sentry.edge.config.ts',
  'instrumentation-client.ts',
  'instrumentation.ts',
  'drizzle.config.ts',
  'playwright.config.ts',
  'next.config.ts',
  'lib/env.ts',
  'lib/logger.ts',
  'lib/posthog/',
  'scripts/',
  '.test.',
  '.spec.',
  '__tests__',
  'e2e/',
  '.github/',
];

function isExempt(filePath: string): boolean {
  const rel = relative(ROOT, filePath);
  return EXEMPT_PATTERNS.some((p) => rel.includes(p));
}

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'node_modules' || entry === '.next' || entry === '.git') continue;
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

// NEXT_PUBLIC_ vars are inlined at build time by Next.js, so client-side
// access like `process.env.NEXT_PUBLIC_*` in 'use client' files is expected.
// We only flag server-side process.env usage of non-NEXT_PUBLIC_ vars,
// plus any NEXT_PUBLIC_ vars in server files (which should use publicEnv()).
const PROCESS_ENV_RE = /process\.env\.(?!NODE_ENV|NEXT_RUNTIME)[A-Z_]+/g;

const violations: { file: string; line: number; match: string }[] = [];

for (const file of walk(ROOT)) {
  if (isExempt(file)) continue;

  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');

  // Check if this is a client component — NEXT_PUBLIC_ direct access is fine there
  const isClientFile = content.startsWith("'use client'") || content.startsWith('"use client"');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matches = Array.from(line.matchAll(PROCESS_ENV_RE));
    for (const m of matches) {
      // Allow NEXT_PUBLIC_ in client files (Next.js inlines these at build time)
      if (isClientFile && m[0].includes('NEXT_PUBLIC_')) continue;
      violations.push({ file: relative(ROOT, file), line: i + 1, match: m[0] });
    }
  }
}

if (violations.length > 0) {
  console.error(
    `Found ${violations.length} direct process.env access(es) — use serverEnv() or publicEnv() instead:\n`,
  );
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} → ${v.match}`);
  }
  process.exit(1);
} else {
  console.log('No direct process.env violations found.');
}
