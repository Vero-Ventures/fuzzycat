// ── API key service: generation, validation, revocation ──────────────
// API keys use a SHA-256 hash for storage — the plaintext key is returned
// only once at creation time. Format: fc_live_<32 hex chars> (128-bit).

import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import type { ApiPermission } from '@/server/api/types';
import { API_PERMISSIONS } from '@/server/api/types';
import { db } from '@/server/db';
import { apiKeys } from '@/server/db/schema';
import { logAuditEvent } from '@/server/services/audit';

// ── Constants ────────────────────────────────────────────────────────

const KEY_PREFIX = 'fc_live_';
const KEY_BYTES = 16; // 128-bit
const DISPLAY_PREFIX_LENGTH = 12; // e.g. "fc_live_a1b2"

// ── Types ────────────────────────────────────────────────────────────

export interface CreateApiKeyOptions {
  actorId?: string;
  /** Optional expiration date. After this time, the key is rejected. */
  expiresAt?: Date;
  /** Optional IP allowlist. If set, requests from other IPs are rejected. */
  allowedIps?: string[];
}

export interface CreateApiKeyResult {
  /** The API key ID (database UUID). */
  id: string;
  /** The plaintext API key — shown once, never stored. */
  plaintextKey: string;
  /** The display prefix for identification. */
  keyPrefix: string;
}

export interface ApiKeyInfo {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  allowedIps: string[] | null;
  createdAt: Date | null;
  revokedAt: Date | null;
}

export interface ValidatedApiKey {
  id: string;
  clinicId: string;
  permissions: string[];
}

// ── Internal helpers ─────────────────────────────────────────────────

function hashKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

function generatePlaintextKey(): string {
  return KEY_PREFIX + randomBytes(KEY_BYTES).toString('hex');
}

function validatePermissions(permissions: string[]): ApiPermission[] {
  const valid = new Set<string>(API_PERMISSIONS);
  const invalid = permissions.filter((p) => !valid.has(p));
  if (invalid.length > 0) {
    throw new Error(`Invalid permissions: ${invalid.join(', ')}`);
  }
  return permissions as ApiPermission[];
}

// ── Service functions ────────────────────────────────────────────────

/**
 * Generate a new API key for a clinic.
 * Returns the plaintext key exactly once — it is not stored.
 */
export async function generateApiKey(
  clinicId: string,
  name: string,
  permissions: string[],
  options?: CreateApiKeyOptions | string,
): Promise<CreateApiKeyResult> {
  // Backwards-compat: old signature passed actorId as 4th arg
  const opts: CreateApiKeyOptions =
    typeof options === 'string' ? { actorId: options } : (options ?? {});

  const validPermissions = validatePermissions(permissions);
  const plaintextKey = generatePlaintextKey();
  const keyHash = hashKey(plaintextKey);
  const keyPrefix = plaintextKey.slice(0, DISPLAY_PREFIX_LENGTH);

  const [inserted] = await db
    .insert(apiKeys)
    .values({
      clinicId,
      name,
      keyHash,
      keyPrefix,
      permissions: validPermissions,
      ...(opts.expiresAt && { expiresAt: opts.expiresAt }),
      ...(opts.allowedIps && { allowedIps: opts.allowedIps }),
    })
    .returning({ id: apiKeys.id });

  await logAuditEvent({
    entityType: 'api_key',
    entityId: inserted.id,
    action: 'created',
    oldValue: null,
    newValue: {
      clinicId,
      name,
      permissions: validPermissions,
      ...(opts.expiresAt && { expiresAt: opts.expiresAt.toISOString() }),
      ...(opts.allowedIps && { allowedIps: opts.allowedIps }),
    },
    actorType: opts.actorId ? 'clinic' : 'system',
    actorId: opts.actorId ?? null,
  });

  logger.info('API key created', { clinicId, apiKeyId: inserted.id, name });

  return {
    id: inserted.id,
    plaintextKey,
    keyPrefix,
  };
}

/**
 * Validate an API key and return the associated clinic + permissions.
 * Returns null if the key is invalid, revoked, expired, or IP-rejected.
 * Updates `lastUsedAt` on successful validation.
 */
export async function validateApiKey(
  plaintextKey: string,
  options?: { ipAddress?: string },
): Promise<ValidatedApiKey | null> {
  if (!plaintextKey.startsWith(KEY_PREFIX)) {
    return null;
  }

  const keyHash = hashKey(plaintextKey);

  const [row] = await db
    .select({
      id: apiKeys.id,
      clinicId: apiKeys.clinicId,
      permissions: apiKeys.permissions,
      revokedAt: apiKeys.revokedAt,
      expiresAt: apiKeys.expiresAt,
      allowedIps: apiKeys.allowedIps,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (!row) {
    return null;
  }

  // Check expiration
  if (row.expiresAt && new Date() > row.expiresAt) {
    logger.warn('API key expired', { apiKeyId: row.id, clinicId: row.clinicId });
    logAuditEvent({
      entityType: 'api_key',
      entityId: row.id,
      action: 'api_key_expired',
      newValue: { clinicId: row.clinicId, expiresAt: row.expiresAt.toISOString() },
      actorType: 'system',
    });
    return null;
  }

  // Check IP allowlist — fail-safe: reject if allowlist configured but IP unknown
  if (row.allowedIps && row.allowedIps.length > 0) {
    if (!options?.ipAddress || !row.allowedIps.includes(options.ipAddress)) {
      logger.warn('API key IP not allowed or missing', {
        apiKeyId: row.id,
        clinicId: row.clinicId,
        ip: options?.ipAddress,
      });
      logAuditEvent({
        entityType: 'api_key',
        entityId: row.id,
        action: 'api_key_ip_rejected',
        newValue: { clinicId: row.clinicId, ip: options?.ipAddress ?? 'unknown' },
        actorType: 'system',
      });
      return null;
    }
  }

  // Fire-and-forget lastUsedAt update (non-blocking)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id))
    .then(() => {})
    .catch((err) => {
      logger.error('Failed to update API key lastUsedAt', {
        apiKeyId: row.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });

  return {
    id: row.id,
    clinicId: row.clinicId,
    permissions: row.permissions,
  };
}

/**
 * Revoke an API key (soft-delete by setting revokedAt).
 */
export async function revokeApiKey(
  apiKeyId: string,
  clinicId: string,
  actorId?: string,
): Promise<boolean> {
  const [updated] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, apiKeyId), eq(apiKeys.clinicId, clinicId), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id });

  if (!updated) {
    return false;
  }

  await logAuditEvent({
    entityType: 'api_key',
    entityId: apiKeyId,
    action: 'status_changed',
    oldValue: { clinicId, revokedAt: null },
    newValue: { clinicId, revokedAt: new Date().toISOString() },
    actorType: actorId ? 'clinic' : 'system',
    actorId: actorId ?? null,
  });

  logger.info('API key revoked', { clinicId, apiKeyId });

  return true;
}

/**
 * List all API keys for a clinic (excludes the key hash, shows prefix only).
 */
export async function listApiKeys(clinicId: string): Promise<ApiKeyInfo[]> {
  const rows = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      permissions: apiKeys.permissions,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      allowedIps: apiKeys.allowedIps,
      createdAt: apiKeys.createdAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.clinicId, clinicId));

  return rows;
}
