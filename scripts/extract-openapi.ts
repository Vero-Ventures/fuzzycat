/**
 * Extract the OpenAPI spec from the Hono app for offline linting.
 *
 * Imports createApiApp(), makes a synthetic request to /openapi.json,
 * and writes the result to .next/openapi.json. This allows tools like
 * Spectral to lint the spec without a running server.
 *
 * Usage: bun run scripts/extract-openapi.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createApiApp } from '@/server/api/app';

const OUTPUT_DIR = join(import.meta.dir, '..', '.next');
const OUTPUT_PATH = join(OUTPUT_DIR, 'openapi.json');

const app = createApiApp();
const res = await app.request('/openapi.json');

if (!res.ok) {
  console.error(`ERROR: Failed to extract OpenAPI spec (HTTP ${res.status})`);
  process.exit(1);
}

const spec = await res.json();

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, JSON.stringify(spec, null, 2));

const endpointCount = Object.keys(spec.paths ?? {}).reduce(
  (sum: number, path: string) => sum + Object.keys(spec.paths[path]).length,
  0,
);

console.log(`OpenAPI spec extracted:`);
console.log(`  Output:    ${OUTPUT_PATH}`);
console.log(`  Version:   ${spec.openapi}`);
console.log(`  Title:     ${spec.info?.title}`);
console.log(`  Endpoints: ${endpointCount}`);
