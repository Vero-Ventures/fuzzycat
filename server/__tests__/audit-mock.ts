/**
 * Shared logAuditEvent mock factory for test files.
 *
 * Bun's mock.module is global per test run, so every test file that uses
 * services depending on @/server/services/audit must mock it explicitly.
 * This factory produces a consistent mock that mirrors the real
 * implementation's "never throw" contract and delegates insert calls to
 * the test file's own mockInsert function.
 *
 * Usage:
 *   import { createAuditMock } from './audit-mock';
 *   mock.module('@/server/services/audit', () => createAuditMock(mockInsert));
 */

// biome-ignore lint/suspicious/noExplicitAny: Mock type — intentionally loose for test flexibility.
type MockInsertFn = (...args: any[]) => any;

export function createAuditMock(mockInsert: MockInsertFn) {
  return {
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    logAuditEvent: async (params: Record<string, unknown>, tx?: any) => {
      try {
        const executor = tx ?? { insert: mockInsert };
        await executor.insert('auditLog').values({
          entityType: params.entityType,
          entityId: params.entityId,
          action: params.action,
          oldValue: params.oldValue ?? null,
          newValue: params.newValue ?? null,
          actorType: params.actorType,
          ...(params.actorId !== undefined && { actorId: params.actorId }),
          ...(params.ipAddress !== undefined && { ipAddress: params.ipAddress }),
        });
      } catch {
        // Mirror real implementation: never throw from audit logging
      }
    },
  };
}
