import { NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import {
  escalateDefault,
  identifyDuePayments,
  identifyPlansForEscalation,
} from '@/server/services/collection';
import { processInstallment } from '@/server/services/payment';
import {
  escalateSoftCollection,
  identifyPendingEscalations,
} from '@/server/services/soft-collection';

interface CollectionResults {
  duePayments: number;
  processed: number;
  failed: number;
  softCollectionEscalations: number;
  planEscalations: number;
}

const BATCH_SIZE = 5;

async function processDuePayments(results: CollectionResults) {
  const duePayments = await identifyDuePayments();
  results.duePayments = duePayments.length;

  for (let i = 0; i < duePayments.length; i += BATCH_SIZE) {
    const batch = duePayments.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map((payment) => processInstallment({ paymentId: payment.id })),
    );
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.processed++;
      } else {
        results.failed++;
        logger.error('Failed to process installment', {
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }
  }
}

async function processSoftCollections(results: CollectionResults) {
  const pendingEscalations = await identifyPendingEscalations();

  for (let i = 0; i < pendingEscalations.length; i += BATCH_SIZE) {
    const batch = pendingEscalations.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map((collection) => escalateSoftCollection(collection.id)),
    );
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.softCollectionEscalations++;
      } else {
        logger.error('Failed to escalate soft collection', {
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }
  }
}

async function processPlanEscalations(results: CollectionResults) {
  const plansForEscalation = await identifyPlansForEscalation();

  for (let i = 0; i < plansForEscalation.length; i += BATCH_SIZE) {
    const batch = plansForEscalation.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(batch.map((planId) => escalateDefault(planId)));
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.planEscalations++;
      } else {
        logger.error('Failed to escalate plan to default', {
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }
  }
}

/**
 * Cron endpoint for payment collection cycle.
 *
 * Runs the following steps in order:
 * 1. Identify and process due installment payments
 * 2. Escalate soft collections that are overdue
 * 3. Escalate plans to defaulted where appropriate
 */
export async function GET(request: Request) {
  const { CRON_SECRET } = serverEnv();

  if (!CRON_SECRET) {
    logger.error('CRON_SECRET not configured — rejecting cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    logger.warn('Unauthorized cron request', { endpoint: '/api/cron/collect-payments' });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: CollectionResults = {
    duePayments: 0,
    processed: 0,
    failed: 0,
    softCollectionEscalations: 0,
    planEscalations: 0,
  };

  try {
    await processDuePayments(results);
    await processSoftCollections(results);
    await processPlanEscalations(results);

    logger.info('Collection cron completed', { ...results });
    return NextResponse.json({ ok: true, ...results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Cron collect-payments failed', { error: message });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
