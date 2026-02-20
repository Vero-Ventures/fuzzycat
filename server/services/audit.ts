// ── Audit log service ────────────────────────────────────────────────
// Canonical utility for logging audit events. Every state change in the
// system (payment, plan, payout, risk pool) MUST go through this service
// to maintain a compliance-ready, append-only audit trail.

import { and, desc, eq } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import { logger } from '@/lib/logger';
import { db } from '@/server/db';
import { auditLog } from '@/server/db/schema';

// ── Types ─────────────────────────────────────────────────────────────

export type EntityType = 'plan' | 'payment' | 'payout' | 'risk_pool' | 'clinic' | 'owner';
export type AuditAction = 'created' | 'status_changed' | 'retried' | 'defaulted' | 'claimed';
export type ActorType = 'system' | 'admin' | 'owner' | 'clinic';

export interface AuditEventParams {
  entityType: EntityType;
  entityId: string;
  action: AuditAction;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  actorType: ActorType;
  actorId?: string | null;
  ipAddress?: string | null;
}

// biome-ignore lint/suspicious/noExplicitAny: Drizzle transaction types are complex generics that vary by driver; using `any` here avoids coupling to a specific driver implementation.
type DrizzleTx = PgTransaction<any, any, any>;

// ── Core audit logger ─────────────────────────────────────────────────

/**
 * Log an audit event to the audit_log table.
 *
 * This is the canonical function for audit logging. All state changes
 * (payment status, plan status, payout status, risk pool operations)
 * should use this function rather than inserting into auditLog directly.
 *
 * Supports an optional Drizzle transaction (`tx`) parameter so that
 * audit entries can be written atomically with the state change they
 * describe. When `tx` is not provided, uses the default db instance.
 *
 * This function never throws — audit failures are logged to the
 * application logger but do not interrupt business logic. In a
 * compliance audit, missing entries can be reconciled from the
 * application logs.
 */
export async function logAuditEvent(params: AuditEventParams, tx?: DrizzleTx): Promise<void> {
  const executor = tx ?? db;

  try {
    await executor.insert(auditLog).values({
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      oldValue: params.oldValue ? JSON.stringify(params.oldValue) : null,
      newValue: params.newValue ? JSON.stringify(params.newValue) : null,
      actorType: params.actorType,
      actorId: params.actorId ?? undefined,
      ipAddress: params.ipAddress ?? undefined,
    });
  } catch (error) {
    // Never throw from audit logging — log to application logger instead.
    // In a production system, this would also fire a Sentry alert.
    logger.error('Failed to write audit log entry', {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ── Query helpers ─────────────────────────────────────────────────────

/**
 * Retrieve audit log entries for a specific entity, ordered by most
 * recent first. Useful for compliance review and debugging.
 */
export async function getAuditLogByEntity(
  entityType: EntityType,
  entityId: string,
): Promise<(typeof auditLog.$inferSelect)[]> {
  return db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.entityType, entityType), eq(auditLog.entityId, entityId)))
    .orderBy(desc(auditLog.createdAt));
}

/**
 * Retrieve all audit log entries for a given entity type, ordered by
 * most recent first, with pagination support.
 */
export async function getAuditLogByType(
  entityType: EntityType,
  options: { limit?: number; offset?: number } = {},
): Promise<(typeof auditLog.$inferSelect)[]> {
  const { limit = 50, offset = 0 } = options;

  return db
    .select()
    .from(auditLog)
    .where(eq(auditLog.entityType, entityType))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
    .offset(offset);
}
