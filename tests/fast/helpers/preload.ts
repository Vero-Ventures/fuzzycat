import { loadEnvConfig } from '@next/env';

// Bun test sets NODE_ENV=test, which makes @next/env skip .env.local.
// Temporarily unset it so loadEnvConfig loads .env.local like `next dev` does.
const savedNodeEnv = process.env.NODE_ENV;
// biome-ignore lint/performance/noDelete: = undefined becomes the string "undefined"
delete (process.env as Record<string, string | undefined>).NODE_ENV;
loadEnvConfig(process.cwd());
(process.env as Record<string, string | undefined>).NODE_ENV = savedNodeEnv;

// Dynamic imports so module-level process.env reads see loaded values
const { afterAll } = await import('bun:test');
const { getAuthCookies } = await import('./auth');
const { BASE_URL } = await import('./fetch');

type Subprocess = import('bun').Subprocess;
let serverProcess: Subprocess | null = null;

async function isServerReady(): Promise<boolean> {
  try {
    await fetch(`${BASE_URL}/api/health`, {
      signal: AbortSignal.timeout(2000),
    });
    // Any response (even 503) means the server is accepting connections
    return true;
  } catch {
    return false;
  }
}

async function waitForServer(maxWaitMs = 60_000): Promise<void> {
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
    env: { ...process.env, NODE_ENV: 'development' },
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
