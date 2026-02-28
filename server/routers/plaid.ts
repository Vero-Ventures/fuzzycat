// ── Plaid tRPC router ────────────────────────────────────────────────
// Exposes Plaid service functions as typed procedures for Link token
// creation, public token exchange, and balance checking.

import { TRPCError } from '@trpc/server';
import { isAxiosError } from 'axios';
import { z } from 'zod';
import { revalidateTag } from '@/lib/cache';
import { logger } from '@/lib/logger';
import { checkBalance, createLinkToken, exchangePublicToken } from '@/server/services/plaid';
import { ownerProcedure, router } from '@/server/trpc';

/**
 * Extract a user-safe message and log structured details from Plaid API errors.
 * Plaid wraps errors in AxiosError with a response body containing error_type,
 * error_code, error_message, and display_message fields.
 */
function handlePlaidError(
  error: unknown,
  fallbackMessage: string,
  context: Record<string, string>,
) {
  if (isAxiosError(error) && error.response?.data) {
    const data = error.response.data as Record<string, unknown>;
    logger.error('Plaid API error', {
      ...context,
      errorType: data.error_type,
      errorCode: data.error_code,
      errorMessage: data.error_message,
      httpStatus: error.response.status,
    });
    const displayMessage =
      typeof data.display_message === 'string' && data.display_message
        ? data.display_message
        : fallbackMessage;
    return displayMessage;
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  logger.error(fallbackMessage, { ...context, error: message });
  return fallbackMessage;
}

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
      const message = handlePlaidError(
        error,
        'Failed to create bank connection. Please try again.',
        {
          procedure: 'createLinkToken',
          userId: ctx.session.userId,
        },
      );
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
        revalidateTag(`owner:${ctx.ownerId}:profile`);
        return { success: true as const, itemId: result.itemId };
      } catch (error) {
        const message = handlePlaidError(
          error,
          'Failed to connect bank account. Please try again.',
          {
            procedure: 'exchangePublicToken',
            ownerId: ctx.ownerId,
          },
        );
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
        const message = handlePlaidError(error, 'Failed to check balance. Please try again.', {
          procedure: 'checkBalance',
          ownerId: ctx.ownerId,
        });
        throw new TRPCError({ code: 'BAD_REQUEST', message });
      }
    }),
});
