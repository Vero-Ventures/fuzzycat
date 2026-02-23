// ── Plaid tRPC router ────────────────────────────────────────────────
// Exposes Plaid service functions as typed procedures for Link token
// creation, public token exchange, and balance checking.

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { checkBalance, createLinkToken, exchangePublicToken } from '@/server/services/plaid';
import { ownerProcedure, router } from '@/server/trpc';

export const plaidRouter = router({
  /**
   * Create a Plaid Link token for the bank connection flow.
   * The frontend uses this token to initialize Plaid Link.
   */
  createLinkToken: ownerProcedure.mutation(async ({ ctx }) => {
    try {
      const linkToken = await createLinkToken(ctx.session.userId);
      return { linkToken };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create Link token';
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message });
    }
  }),

  /**
   * Exchange a Plaid public token for an access token after the user
   * successfully connects their bank via Plaid Link.
   */
  exchangePublicToken: ownerProcedure
    .input(
      z.object({
        publicToken: z.string().min(1, 'Public token is required'),
        accountId: z.string().min(1, 'Account ID is required'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await exchangePublicToken(input.publicToken, ctx.ownerId, input.accountId);
        return { success: true as const, itemId: result.itemId };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to exchange public token';
        throw new TRPCError({ code: 'BAD_REQUEST', message });
      }
    }),

  /**
   * Check if the owner's bank account has sufficient balance for the
   * deposit and first 2 installments.
   */
  checkBalance: ownerProcedure
    .input(
      z.object({
        requiredCents: z.number().int().positive('Required amount must be a positive integer'),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await checkBalance(ctx.ownerId, input.requiredCents);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to check balance';
        throw new TRPCError({ code: 'BAD_REQUEST', message });
      }
    }),
});
