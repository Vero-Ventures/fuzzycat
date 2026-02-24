import { afterAll } from 'bun:test';
import { loadEnvConfig } from '@next/env';
import type { Subprocess } from 'bun';
import { getAuthCookies } from './auth';
import { BASE_URL } from './fetch';

loadEnvConfig(process.cwd());

let serverProcess: Subprocess | null = null;

async function isServerReady(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer(maxWaitMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (await isServerReady()) return;
    await Bun.sleep(500);
  }
  throw new Error(`Dev server did not become ready within ${maxWaitMs}ms`);
}

// Check if server is running; if not, start it
const ready = await isServerReady();
if (!ready) {
  console.log('[fast:preload] Dev server not running, starting...');
  serverProcess = Bun.spawn(['bun', 'run', 'dev'], {
    cwd: process.cwd(),
    stdout: 'inherit',
    stderr: 'inherit',
  });
  await waitForServer();
  console.log('[fast:preload] Dev server ready.');
}

// Pre-authenticate all roles in parallel
await Promise.all([
  getAuthCookies('owner'),
  getAuthCookies('clinic'),
  getAuthCookies('admin'),
]).catch((err) => {
  console.warn('[fast:preload] Auth pre-warm failed (tests needing auth will fail):', err);
});

afterAll(() => {
  if (serverProcess) {
    console.log('[fast:preload] Stopping dev server...');
    serverProcess.kill();
    serverProcess = null;
  }
});
