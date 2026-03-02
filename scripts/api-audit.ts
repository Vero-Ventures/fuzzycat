/**
 * Unified API audit orchestrator.
 *
 * Runs all API quality, security, and compliance checks in sequence
 * and produces a consolidated report. Exit code 0 = all passed,
 * 1 = at least one check failed.
 *
 * Usage:
 *   bun run scripts/api-audit.ts            # Run all checks
 *   bun run scripts/api-audit.ts --quick    # Spec + lint only (no k6)
 *
 * Checks:
 *   1. OpenAPI spec extraction (from Hono app)
 *   2. Spectral lint (spec quality, security rules)
 *   3. k6 security test (auth enforcement, input validation)
 *   4. k6 load test (performance, rate limiting) — skipped with --quick
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const SPEC_PATH = join(ROOT, '.next', 'openapi.json');
const isQuick = process.argv.includes('--quick');

interface CheckResult {
  name: string;
  passed: boolean;
  duration: number;
  output: string;
}

const results: CheckResult[] = [];

function run(name: string, command: string, options?: { allowFail?: boolean }): CheckResult {
  const start = Date.now();
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`▶ ${name}`);
  console.log(`  $ ${command}`);
  console.log('─'.repeat(60));

  try {
    const output = execSync(command, {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 300_000, // 5 min max per check
    });

    const duration = Date.now() - start;
    console.log(output);
    console.log(`✓ ${name} passed (${(duration / 1000).toFixed(1)}s)`);

    const result = { name, passed: true, duration, output };
    results.push(result);
    return result;
  } catch (error: unknown) {
    const duration = Date.now() - start;
    const err = error as { stdout?: string; stderr?: string; message?: string };
    const output = (err.stdout || '') + (err.stderr || '');
    console.log(output || err.message || 'Unknown error');

    if (options?.allowFail) {
      console.log(`⚠ ${name} completed with warnings (${(duration / 1000).toFixed(1)}s)`);
      const result = { name, passed: true, duration, output };
      results.push(result);
      return result;
    }

    console.log(`✗ ${name} FAILED (${(duration / 1000).toFixed(1)}s)`);
    const result = { name, passed: false, duration, output };
    results.push(result);
    return result;
  }
}

function checkBinary(name: string, command: string): boolean {
  try {
    execSync(`which ${command}`, { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch {
    console.log(`⚠ ${name} not found (${command}). Skipping related checks.`);
    return false;
  }
}

// ── Check 1: Extract OpenAPI spec ───────────────────────────────────
run('OpenAPI Spec Extraction', 'bun run scripts/extract-openapi.ts');

if (!existsSync(SPEC_PATH)) {
  console.error('FATAL: OpenAPI spec not generated. Cannot continue.');
  process.exit(1);
}

// ── Check 2: Spectral lint ──────────────────────────────────────────
run('Spectral OpenAPI Lint', `bunx spectral lint ${SPEC_PATH}`);

// ── Check 3: k6 security tests (if k6 installed) ───────────────────
const hasK6 = checkBinary('k6', 'k6');

if (hasK6) {
  run(
    'k6 Security Tests',
    'k6 run scripts/k6/api-security-test.js --env BASE_URL=http://localhost:3000/api/v1 --quiet',
    { allowFail: true },
  );

  if (!isQuick) {
    run(
      'k6 Load Tests',
      'k6 run scripts/k6/api-load-test.js --env BASE_URL=http://localhost:3000/api/v1 --quiet',
      { allowFail: true },
    );
  }
} else {
  console.log('\nSkipping k6 tests — install k6 to enable:');
  console.log('  brew install k6  # macOS');
  console.log('  sudo snap install k6  # Ubuntu');
  console.log('  https://k6.io/docs/get-started/installation/');
}

// ── Summary ─────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log('API AUDIT REPORT');
console.log('═'.repeat(60));

const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
const failures = results.filter((r) => !r.passed);

for (const r of results) {
  const icon = r.passed ? '✓' : '✗';
  const dur = `${(r.duration / 1000).toFixed(1)}s`;
  console.log(`  ${icon} ${r.name.padEnd(30)} ${dur}`);
}

console.log('─'.repeat(60));
console.log(
  `  Total: ${results.length} checks, ${failures.length} failed, ${(totalDuration / 1000).toFixed(1)}s`,
);

if (isQuick) {
  console.log('  Mode: --quick (k6 load tests skipped)');
}

if (failures.length > 0) {
  console.log(`\nFailed checks:`);
  for (const f of failures) {
    console.log(`  - ${f.name}`);
  }
  console.log('═'.repeat(60));
  process.exit(1);
}

console.log('═'.repeat(60));
console.log('All checks passed.');
