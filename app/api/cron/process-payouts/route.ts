import { NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { processPendingPayouts } from '@/server/services/payout';

export async function GET(request: Request) {
  const { CRON_SECRET } = serverEnv();

  if (!CRON_SECRET) {
    logger.error('CRON_SECRET not configured — rejecting cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    logger.warn('Unauthorized cron request', {
      endpoint: '/api/cron/process-payouts',
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processPendingPayouts();

    return NextResponse.json({
      ok: true,
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      results: result.results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Cron process-payouts failed', { error: message });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
