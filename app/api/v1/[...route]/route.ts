// ── Next.js catch-all route for external REST API ────────────────────
// Forwards all /api/v1/* requests to the Hono app via the Vercel adapter.

import { handle } from 'hono/vercel';
import { createApiApp } from '@/server/api/app';

const app = createApiApp();

export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
export const OPTIONS = handle(app);
