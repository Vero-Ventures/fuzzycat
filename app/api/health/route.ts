import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { publicEnv, serverEnv } from '@/lib/env';
import { db } from '@/server/db';

interface CheckResult {
  status: 'ok' | 'fail';
  error?: string;
}

const isProduction = () => process.env.NODE_ENV === 'production';

function maskError(error: unknown, fallback: string): string {
  return isProduction() ? fallback : (error as Error).message;
}

async function runCheck(fn: () => Promise<void> | void, errorLabel: string): Promise<CheckResult> {
  try {
    await fn();
    return { status: 'ok' };
  } catch (error) {
    return { status: 'fail', error: maskError(error, errorLabel) };
  }
}

function deriveOverallStatus(checks: Record<string, CheckResult>): 'ok' | 'degraded' | 'error' {
  const dbOk = checks.database?.status === 'ok';
  const allHealthy = Object.values(checks).every((c) => c.status === 'ok');

  if (!dbOk) return 'error';
  if (!allHealthy) return 'degraded';
  return 'ok';
}

export async function GET() {
  const checks: Record<string, CheckResult> = {};

  checks.publicEnv = await runCheck(() => {
    publicEnv();
  }, 'validation failed');
  checks.serverEnv = await runCheck(() => {
    serverEnv();
  }, 'validation failed');

  checks.database = await runCheck(async () => {
    await db.execute(sql`SELECT 1`);
  }, 'unreachable');

  checks.stripe = await runCheck(async () => {
    const { stripe } = await import('@/lib/stripe');
    await stripe().balance.retrieve();
  }, 'unreachable');

  const overallStatus = deriveOverallStatus(checks);
  const httpStatus = overallStatus === 'ok' ? 200 : 503;

  return NextResponse.json(
    { status: overallStatus, checks },
    {
      status: httpStatus,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
