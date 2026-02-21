/**
 * Global teardown — intentionally a no-op.
 * Test users are reused across runs to avoid provisioning overhead.
 */
async function globalTeardown() {
  // No cleanup needed — test users persist in Supabase
}

export default globalTeardown;
