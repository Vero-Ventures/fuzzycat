import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { publicEnv, serverEnv } from '@/lib/env';
import { db } from '@/server/db';

interface CheckResult {
  status: 'ok' | 'fail';
  error?: string;
}

export async function GET() {
  const isProduction = process.env.NODE_ENV === 'production';
  const checks: Record<string, CheckResult> = {};

  // 1. Public env vars
  try {
    publicEnv();
    checks.publicEnv = { status: 'ok' };
  } catch (error) {
    checks.publicEnv = {
      status: 'fail',
      error: isProduction ? 'validation failed' : (error as Error).message,
    };
  }

  // 2. Server env vars
  try {
    serverEnv();
    checks.serverEnv = { status: 'ok' };
  } catch (error) {
    checks.serverEnv = {
      status: 'fail',
      error: isProduction ? 'validation failed' : (error as Error).message,
    };
  }

  // 3. Database connectivity
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = { status: 'ok' };
  } catch (error) {
    checks.database = {
      status: 'fail',
      error: isProduction ? 'unreachable' : (error as Error).message,
    };
  }

  const allHealthy = Object.values(checks).every((c) => c.status === 'ok');
  const status = allHealthy ? 200 : 503;

  return NextResponse.json(
    { status: allHealthy ? 'ok' : 'degraded', checks },
    {
      status,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
