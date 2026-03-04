import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { cachedQuery, revalidateTag } from '@/lib/cache';
import { logger } from '@/lib/logger';
import { stripe } from '@/lib/stripe';
import { clients, clinics, payments, pets, plans } from '@/server/db/schema';
import { logAuditEvent } from '@/server/services/audit';
import { clientProcedure, router } from '@/server/trpc';

/** Retrieve card details from Stripe, returning null on error. */
async function fetchCardDetails(
  cardPaymentMethodId: string,
  ownerId: string,
): Promise<{ brand: string; last4: string; expMonth: number; expYear: number } | null> {
  try {
    const pm = await stripe().paymentMethods.retrieve(cardPaymentMethodId);
    if (pm.card) {
      return {
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
      };
    }
  } catch (err) {
    logger.error('Failed to retrieve card payment method from Stripe', {
      ownerId,
      paymentMethodId: cardPaymentMethodId,
      error: err,
    });
  }
  return null;
}

/** Retrieve ACH bank account details from Stripe, returning null on error. */
async function fetchBankAccountDetails(
  achPaymentMethodId: string,
  ownerId: string,
): Promise<{ bankName: string; last4: string } | null> {
  try {
    const pm = await stripe().paymentMethods.retrieve(achPaymentMethodId);
    if (pm.us_bank_account) {
      return {
        bankName: pm.us_bank_account.bank_name ?? 'Bank Account',
        last4: pm.us_bank_account.last4 ?? '****',
      };
    }
  } catch (err) {
    logger.error('Failed to retrieve ACH payment method from Stripe', {
      ownerId,
      paymentMethodId: achPaymentMethodId,
      error: err,
    });
  }
  return null;
}

/** Detach a card or bank source from Stripe. Logs errors but does not throw. */
async function detachStripeInstrument(
  method: 'debit_card' | 'bank_account',
  owner: {
    stripeCustomerId: string | null;
    stripeCardPaymentMethodId: string | null;
    stripeAchPaymentMethodId: string | null;
  },
  ownerId: string,
): Promise<void> {
  if (method === 'debit_card' && owner.stripeCardPaymentMethodId) {
    try {
      await stripe().paymentMethods.detach(owner.stripeCardPaymentMethodId);
    } catch (err) {
      logger.error('Failed to detach card payment method from Stripe', {
        ownerId,
        paymentMethodId: owner.stripeCardPaymentMethodId,
        error: err,
      });
    }
    return;
  }

  if (method === 'bank_account' && owner.stripeAchPaymentMethodId) {
    try {
      await stripe().paymentMethods.detach(owner.stripeAchPaymentMethodId);
    } catch (err) {
      logger.error('Failed to detach ACH payment method from Stripe', {
        ownerId,
        paymentMethodId: owner.stripeAchPaymentMethodId,
        error: err,
      });
    }
  }
}

/** Build the DB update fields for removing a payment method. */
function buildRemoveFields(
  method: 'debit_card' | 'bank_account',
  currentMethod: string,
  otherMethodExists: boolean,
): { updateFields: Record<string, unknown>; switchedTo: string | null } {
  const updateFields: Record<string, unknown> = {};
  let switchedTo: string | null = null;

  if (method === 'debit_card') {
    updateFields.stripeCardPaymentMethodId = null;
  } else {
    updateFields.stripeAchPaymentMethodId = null;
  }

  if (currentMethod === method && otherMethodExists) {
    const newMethod = method === 'debit_card' ? 'bank_account' : 'debit_card';
    updateFields.paymentMethod = newMethod;
    switchedTo = newMethod;
  }

  return { updateFields, switchedTo };
}

export const clientRouter = router({
  healthCheck: clientProcedure.query(() => {
    return { status: 'ok' as const, router: 'client' };
  }),

  /**
   * Get the authenticated owner's profile information.
   */
  getProfile: clientProcedure.query(async ({ ctx }) => {
    return cachedQuery(
      async () => {
        const [owner] = await ctx.db
          .select({
            id: clients.id,
            name: clients.name,
            email: clients.email,
            phone: clients.phone,
            petName: clients.petName,
            paymentMethod: clients.paymentMethod,
            stripeCardPaymentMethodId: clients.stripeCardPaymentMethodId,
            stripeAchPaymentMethodId: clients.stripeAchPaymentMethodId,
            addressLine1: clients.addressLine1,
            addressCity: clients.addressCity,
            addressState: clients.addressState,
            addressZip: clients.addressZip,
          })
          .from(clients)
          .where(eq(clients.id, ctx.clientId))
          .limit(1);

        if (!owner) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Client profile not found' });
        }

        return owner;
      },
      ['client-profile', ctx.clientId],
      { revalidate: 300, tags: [`owner:${ctx.clientId}:profile`] },
    );
  }),

  /**
   * Update the authenticated owner's profile (email, phone, name).
   */
  updateProfile: clientProcedure
    .input(
      z.object({
        name: z.string().min(1, 'Name is required').optional(),
        email: z.string().email('Valid email is required').optional(),
        phone: z
          .string()
          .regex(/^\+[1-9]\d{1,14}$/, 'Phone must be in E.164 format (e.g., +15551234567)')
          .optional(),
        addressLine1: z.string().min(1, 'Address is required').max(200).optional(),
        addressCity: z.string().min(1, 'City is required').max(100).optional(),
        addressState: z.string().length(2, 'State must be a 2-letter abbreviation').optional(),
        addressZip: z
          .string()
          .regex(/^\d{5}(-\d{4})?$/, 'ZIP must be 5 digits or ZIP+4 format')
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, string> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.email !== undefined) updateData.email = input.email;
      if (input.phone !== undefined) updateData.phone = input.phone;
      if (input.addressLine1 !== undefined) updateData.addressLine1 = input.addressLine1;
      if (input.addressCity !== undefined) updateData.addressCity = input.addressCity;
      if (input.addressState !== undefined) updateData.addressState = input.addressState;
      if (input.addressZip !== undefined) updateData.addressZip = input.addressZip;

      if (Object.keys(updateData).length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No fields to update' });
      }

      const [updated] = await ctx.db
        .update(clients)
        .set(updateData)
        .where(eq(clients.id, ctx.clientId))
        .returning({
          id: clients.id,
          name: clients.name,
          email: clients.email,
          phone: clients.phone,
          petName: clients.petName,
          paymentMethod: clients.paymentMethod,
          addressLine1: clients.addressLine1,
          addressCity: clients.addressCity,
          addressState: clients.addressState,
          addressZip: clients.addressZip,
        });

      revalidateTag(`owner:${ctx.clientId}:profile`);

      return updated;
    }),

  /**
   * Update the authenticated owner's payment method preference.
   * Validates that the owner has a saved instrument for the target method.
   */
  updatePaymentMethod: clientProcedure
    .input(
      z.object({
        paymentMethod: z.enum(['debit_card', 'bank_account']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the owner has a saved instrument for the target method
      const [owner] = await ctx.db
        .select({
          stripeCardPaymentMethodId: clients.stripeCardPaymentMethodId,
          stripeAchPaymentMethodId: clients.stripeAchPaymentMethodId,
          paymentMethod: clients.paymentMethod,
        })
        .from(clients)
        .where(eq(clients.id, ctx.clientId))
        .limit(1);

      if (input.paymentMethod === 'debit_card' && !owner?.stripeCardPaymentMethodId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No debit card on file. Please add a card first.',
        });
      }

      if (input.paymentMethod === 'bank_account' && !owner?.stripeAchPaymentMethodId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No bank account on file. Please connect a bank account first.',
        });
      }

      const oldMethod = owner?.paymentMethod;

      const [updated] = await ctx.db
        .update(clients)
        .set({ paymentMethod: input.paymentMethod })
        .where(eq(clients.id, ctx.clientId))
        .returning({
          id: clients.id,
          paymentMethod: clients.paymentMethod,
        });

      await logAuditEvent({
        entityType: 'owner',
        entityId: ctx.clientId,
        action: 'status_changed',
        oldValue: { paymentMethod: oldMethod },
        newValue: { paymentMethod: input.paymentMethod },
        actorType: 'client',
        actorId: ctx.clientId,
      });

      revalidateTag(`owner:${ctx.clientId}:profile`);

      return updated;
    }),

  /**
   * Remove a saved payment method (debit card or bank account).
   * Detaches the instrument from Stripe, clears DB fields, and auto-switches
   * the preference if the other method is available.
   * Blocks removal if it's the owner's only method and they have active plans.
   */
  removePaymentMethod: clientProcedure
    .input(
      z.object({
        method: z.enum(['debit_card', 'bank_account']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [owner] = await ctx.db
        .select({
          stripeCustomerId: clients.stripeCustomerId,
          stripeCardPaymentMethodId: clients.stripeCardPaymentMethodId,
          stripeAchPaymentMethodId: clients.stripeAchPaymentMethodId,
          paymentMethod: clients.paymentMethod,
        })
        .from(clients)
        .where(eq(clients.id, ctx.clientId))
        .limit(1);

      if (!owner) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Client not found.' });
      }

      // Validate the requested method has a saved instrument
      if (input.method === 'debit_card' && !owner.stripeCardPaymentMethodId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No debit card on file to remove.',
        });
      }

      if (input.method === 'bank_account' && !owner.stripeAchPaymentMethodId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No bank account on file to remove.',
        });
      }

      // Check if the other method has a saved instrument
      const otherMethodHasInstrument =
        input.method === 'debit_card'
          ? !!owner.stripeAchPaymentMethodId
          : !!owner.stripeCardPaymentMethodId;

      // Block removal if this is the only method and owner has active plans
      if (!otherMethodHasInstrument) {
        const activePlans = await ctx.db
          .select({ id: plans.id })
          .from(plans)
          .where(
            and(
              eq(plans.clientId, ctx.clientId),
              inArray(plans.status, ['active', 'deposit_paid']),
            ),
          )
          .limit(1);

        if (activePlans.length > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'Cannot remove your only payment method while you have active plans. Add an alternative payment method first.',
          });
        }
      }

      // Detach from Stripe (logs errors but does not throw)
      await detachStripeInstrument(input.method, owner, ctx.clientId);

      // Clear DB fields and auto-switch if needed
      const { updateFields, switchedTo } = buildRemoveFields(
        input.method,
        owner.paymentMethod,
        otherMethodHasInstrument,
      );

      await ctx.db.update(clients).set(updateFields).where(eq(clients.id, ctx.clientId));

      await logAuditEvent({
        entityType: 'owner',
        entityId: ctx.clientId,
        action: 'payment_method_removed',
        oldValue: {
          method: input.method,
          paymentMethod: owner.paymentMethod,
        },
        newValue: {
          method: input.method,
          removed: true,
          switchedTo,
        },
        actorType: 'client',
        actorId: ctx.clientId,
      });

      revalidateTag(`owner:${ctx.clientId}:profile`);

      return { success: true as const, switchedTo };
    }),

  /**
   * Create a Stripe Checkout Session in setup mode for collecting a debit card.
   * Redirects the user to Stripe's hosted page (avoids needing @stripe/react-stripe-js).
   */
  setupCardPaymentMethod: clientProcedure
    .input(
      z.object({
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [owner] = await ctx.db
        .select({ stripeCustomerId: clients.stripeCustomerId })
        .from(clients)
        .where(eq(clients.id, ctx.clientId))
        .limit(1);

      if (!owner?.stripeCustomerId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No Stripe customer found for this account.',
        });
      }

      const session = await stripe().checkout.sessions.create({
        customer: owner.stripeCustomerId,
        mode: 'setup',
        payment_method_types: ['card'],
        success_url: `${input.successUrl}?setup_session={CHECKOUT_SESSION_ID}`,
        cancel_url: input.cancelUrl,
        metadata: {
          clientId: ctx.clientId,
        },
      });

      return {
        sessionId: session.id,
        sessionUrl: session.url,
      };
    }),

  /**
   * Confirm a card setup after the user completes Stripe Checkout.
   * Retrieves the Checkout Session, extracts the SetupIntent, and saves the payment method.
   */
  confirmCardPaymentMethod: clientProcedure
    .input(
      z.object({
        sessionId: z.string().min(1, 'Checkout session ID is required'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const session = await stripe().checkout.sessions.retrieve(input.sessionId);

      if (session.status !== 'complete') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Checkout session is not complete (status: ${session.status})`,
        });
      }

      const setupIntentId =
        typeof session.setup_intent === 'string' ? session.setup_intent : session.setup_intent?.id;

      if (!setupIntentId) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Checkout session ${input.sessionId} has no SetupIntent`,
        });
      }

      const setupIntent = await stripe().setupIntents.retrieve(setupIntentId);

      if (setupIntent.status !== 'succeeded') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `SetupIntent is not succeeded (status: ${setupIntent.status})`,
        });
      }

      const paymentMethodId =
        typeof setupIntent.payment_method === 'string'
          ? setupIntent.payment_method
          : setupIntent.payment_method?.id;

      if (!paymentMethodId) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `SetupIntent ${setupIntentId} has no payment method`,
        });
      }

      // Fetch existing card PM to detach if replacing
      const [existingOwner] = await ctx.db
        .select({ stripeCardPaymentMethodId: clients.stripeCardPaymentMethodId })
        .from(clients)
        .where(eq(clients.id, ctx.clientId))
        .limit(1);

      const oldCardPmId = existingOwner?.stripeCardPaymentMethodId;

      // Detach old card from Stripe if replacing with a different one
      if (oldCardPmId && oldCardPmId !== paymentMethodId) {
        try {
          await stripe().paymentMethods.detach(oldCardPmId);
        } catch (err) {
          logger.error('Failed to detach old card payment method from Stripe', {
            clientId: ctx.clientId,
            oldPaymentMethodId: oldCardPmId,
            error: err,
          });
        }
      }

      await ctx.db
        .update(clients)
        .set({
          stripeCardPaymentMethodId: paymentMethodId,
          paymentMethod: 'debit_card',
        })
        .where(eq(clients.id, ctx.clientId));

      await logAuditEvent({
        entityType: 'owner',
        entityId: ctx.clientId,
        action:
          oldCardPmId && oldCardPmId !== paymentMethodId
            ? 'payment_method_replaced'
            : 'status_changed',
        oldValue: oldCardPmId ? { stripeCardPaymentMethodId: oldCardPmId } : null,
        newValue: { stripeCardPaymentMethodId: paymentMethodId, paymentMethod: 'debit_card' },
        actorType: 'client',
        actorId: ctx.clientId,
      });

      revalidateTag(`owner:${ctx.clientId}:profile`);

      return { success: true as const, paymentMethodId };
    }),

  /**
   * Create a Stripe SetupIntent for linking a bank account via Financial Connections.
   * Returns a client secret for the frontend to open the Financial Connections modal.
   */
  createBankAccountSetupIntent: clientProcedure.mutation(async ({ ctx }) => {
    const [owner] = await ctx.db
      .select({ stripeCustomerId: clients.stripeCustomerId })
      .from(clients)
      .where(eq(clients.id, ctx.clientId))
      .limit(1);

    if (!owner?.stripeCustomerId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No Stripe customer found for this account.',
      });
    }

    const setupIntent = await stripe().setupIntents.create({
      customer: owner.stripeCustomerId,
      payment_method_types: ['us_bank_account'],
      payment_method_options: {
        us_bank_account: {
          financial_connections: {
            permissions: ['payment_method'],
          },
        },
      },
    });

    return {
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
    };
  }),

  /**
   * Confirm a bank account setup after the user completes Financial Connections.
   * Retrieves the SetupIntent and saves the payment method to the owner record.
   */
  confirmBankAccount: clientProcedure
    .input(z.object({ setupIntentId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const setupIntent = await stripe().setupIntents.retrieve(input.setupIntentId);

      if (setupIntent.status !== 'succeeded') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Bank account setup is not complete (status: ${setupIntent.status})`,
        });
      }

      const paymentMethodId =
        typeof setupIntent.payment_method === 'string'
          ? setupIntent.payment_method
          : setupIntent.payment_method?.id;

      if (!paymentMethodId) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'SetupIntent has no payment method',
        });
      }

      // Detach old bank account PM if replacing
      const [existingOwner] = await ctx.db
        .select({ stripeAchPaymentMethodId: clients.stripeAchPaymentMethodId })
        .from(clients)
        .where(eq(clients.id, ctx.clientId))
        .limit(1);

      const oldAchPmId = existingOwner?.stripeAchPaymentMethodId;

      if (oldAchPmId && oldAchPmId !== paymentMethodId) {
        try {
          await stripe().paymentMethods.detach(oldAchPmId);
        } catch (err) {
          logger.error('Failed to detach old ACH payment method from Stripe', {
            clientId: ctx.clientId,
            oldPaymentMethodId: oldAchPmId,
            error: err,
          });
        }
      }

      await ctx.db
        .update(clients)
        .set({
          stripeAchPaymentMethodId: paymentMethodId,
          paymentMethod: 'bank_account',
        })
        .where(eq(clients.id, ctx.clientId));

      await logAuditEvent({
        entityType: 'owner',
        entityId: ctx.clientId,
        action:
          oldAchPmId && oldAchPmId !== paymentMethodId
            ? 'payment_method_replaced'
            : 'status_changed',
        oldValue: oldAchPmId ? { stripeAchPaymentMethodId: oldAchPmId } : null,
        newValue: { stripeAchPaymentMethodId: paymentMethodId, paymentMethod: 'bank_account' },
        actorType: 'client',
        actorId: ctx.clientId,
      });

      revalidateTag(`owner:${ctx.clientId}:profile`);

      return { success: true as const, paymentMethodId };
    }),

  /**
   * Retrieve saved payment instrument details from Stripe.
   * Returns card brand/last4/expiry and/or bank name/last4 depending on what's on file.
   */
  getPaymentMethodDetails: clientProcedure.query(async ({ ctx }) => {
    const [owner] = await ctx.db
      .select({
        paymentMethod: clients.paymentMethod,
        stripeCardPaymentMethodId: clients.stripeCardPaymentMethodId,
        stripeAchPaymentMethodId: clients.stripeAchPaymentMethodId,
        stripeCustomerId: clients.stripeCustomerId,
      })
      .from(clients)
      .where(eq(clients.id, ctx.clientId))
      .limit(1);

    if (!owner) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Client not found' });
    }

    const card = owner.stripeCardPaymentMethodId
      ? await fetchCardDetails(owner.stripeCardPaymentMethodId, ctx.clientId)
      : null;

    const bankAccount = owner.stripeAchPaymentMethodId
      ? await fetchBankAccountDetails(owner.stripeAchPaymentMethodId, ctx.clientId)
      : null;

    return {
      currentMethod: owner.paymentMethod,
      card,
      bankAccount,
    };
  }),

  /**
   * Get all payment plans for the authenticated owner, with payment progress.
   */
  getPlans: clientProcedure.query(async ({ ctx }) => {
    const plansWithProgress = await ctx.db
      .select({
        id: plans.id,
        clinicId: plans.clinicId,
        totalBillCents: plans.totalBillCents,
        feeCents: plans.feeCents,
        totalWithFeeCents: plans.totalWithFeeCents,
        depositCents: plans.depositCents,
        remainingCents: plans.remainingCents,
        installmentCents: plans.installmentCents,
        numInstallments: plans.numInstallments,
        status: plans.status,
        nextPaymentAt: plans.nextPaymentAt,
        depositPaidAt: plans.depositPaidAt,
        completedAt: plans.completedAt,
        createdAt: plans.createdAt,
        clinicName: clinics.name,
        succeededCount: sql<number>`count(${payments.id}) filter (where ${payments.status} = 'succeeded')`,
        totalPaidCents: sql<number>`coalesce(sum(${payments.amountCents}) filter (where ${payments.status} = 'succeeded'), 0)`,
        totalPayments: sql<number>`count(${payments.id})`,
      })
      .from(plans)
      .leftJoin(clinics, eq(plans.clinicId, clinics.id))
      .leftJoin(payments, eq(plans.id, payments.planId))
      .where(eq(plans.clientId, ctx.clientId))
      .groupBy(plans.id, clinics.id)
      .orderBy(desc(plans.createdAt));

    return plansWithProgress.map((p) => ({
      ...p,
      succeededCount: Number(p.succeededCount),
      totalPaidCents: Number(p.totalPaidCents),
      totalPayments: Number(p.totalPayments),
    }));
  }),

  /**
   * Get a single payment plan by ID for the authenticated owner, with payment progress.
   */
  getPlanById: clientProcedure
    .input(z.object({ planId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select({
          id: plans.id,
          clinicId: plans.clinicId,
          totalBillCents: plans.totalBillCents,
          feeCents: plans.feeCents,
          totalWithFeeCents: plans.totalWithFeeCents,
          depositCents: plans.depositCents,
          remainingCents: plans.remainingCents,
          installmentCents: plans.installmentCents,
          numInstallments: plans.numInstallments,
          status: plans.status,
          nextPaymentAt: plans.nextPaymentAt,
          depositPaidAt: plans.depositPaidAt,
          completedAt: plans.completedAt,
          createdAt: plans.createdAt,
          clinicName: clinics.name,
          succeededCount: sql<number>`count(${payments.id}) filter (where ${payments.status} = 'succeeded')`,
          totalPaidCents: sql<number>`coalesce(sum(${payments.amountCents}) filter (where ${payments.status} = 'succeeded'), 0)`,
          totalPayments: sql<number>`count(${payments.id})`,
        })
        .from(plans)
        .leftJoin(clinics, eq(plans.clinicId, clinics.id))
        .leftJoin(payments, eq(plans.id, payments.planId))
        .where(and(eq(plans.id, input.planId), eq(plans.clientId, ctx.clientId)))
        .groupBy(plans.id, clinics.id);

      const plan = result[0];
      if (!plan) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found' });
      }

      return {
        ...plan,
        succeededCount: Number(plan.succeededCount),
        totalPaidCents: Number(plan.totalPaidCents),
        totalPayments: Number(plan.totalPayments),
      };
    }),

  /**
   * Get paginated payment history for a specific plan.
   * Owner must own the plan.
   */
  getPaymentHistory: clientProcedure
    .input(
      z.object({
        planId: z.string().uuid(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [plan] = await ctx.db
        .select({ id: plans.id, ownerId: plans.clientId })
        .from(plans)
        .where(eq(plans.id, input.planId))
        .limit(1);

      if (!plan) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found' });
      }

      // Admin bypass is handled by clientProcedure allowing admin role
      if (ctx.session.role !== 'admin' && plan.ownerId !== ctx.clientId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this plan' });
      }

      const offset = (input.page - 1) * input.pageSize;

      const [planPayments, countResult] = await Promise.all([
        ctx.db
          .select({
            id: payments.id,
            type: payments.type,
            sequenceNum: payments.sequenceNum,
            amountCents: payments.amountCents,
            status: payments.status,
            scheduledAt: payments.scheduledAt,
            processedAt: payments.processedAt,
            failureReason: payments.failureReason,
            retryCount: payments.retryCount,
          })
          .from(payments)
          .where(eq(payments.planId, input.planId))
          .orderBy(payments.sequenceNum)
          .limit(input.pageSize)
          .offset(offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(payments)
          .where(eq(payments.planId, input.planId)),
      ]);

      const totalCount = Number(countResult[0]?.count ?? 0);
      const totalPages = Math.ceil(totalCount / input.pageSize);

      return {
        payments: planPayments,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          totalCount,
          totalPages,
        },
      };
    }),

  /**
   * Get the 10 most recent payments across all of the owner's plans in a single query.
   * Eliminates the N+1 waterfall of fetching plans, then fetching payments per plan.
   */
  getRecentPayments: clientProcedure.query(async ({ ctx }) => {
    const recentPayments = await ctx.db
      .select({
        id: payments.id,
        type: payments.type,
        sequenceNum: payments.sequenceNum,
        amountCents: payments.amountCents,
        status: payments.status,
        scheduledAt: payments.scheduledAt,
        processedAt: payments.processedAt,
        clinicName: clinics.name,
      })
      .from(payments)
      .innerJoin(plans, eq(payments.planId, plans.id))
      .leftJoin(clinics, eq(plans.clinicId, clinics.id))
      .where(eq(plans.clientId, ctx.clientId))
      .orderBy(desc(payments.scheduledAt))
      .limit(10);

    return recentPayments;
  }),

  /**
   * Get a summary of active plans with next upcoming payment.
   */
  getDashboardSummary: clientProcedure.query(async ({ ctx }) => {
    // Run all three independent queries in parallel
    const [nextPaymentResult, totalsResult, planCountsResult] = await Promise.all([
      // Next upcoming payment across all active plans
      ctx.db
        .select({
          id: payments.id,
          planId: payments.planId,
          amountCents: payments.amountCents,
          scheduledAt: payments.scheduledAt,
          type: payments.type,
          sequenceNum: payments.sequenceNum,
        })
        .from(payments)
        .innerJoin(plans, eq(payments.planId, plans.id))
        .where(and(eq(plans.clientId, ctx.clientId), eq(payments.status, 'pending')))
        .orderBy(payments.scheduledAt)
        .limit(1),

      // Total paid and total remaining across all plans
      ctx.db
        .select({
          totalPaidCents: sql<number>`coalesce(sum(${payments.amountCents}) filter (where ${payments.status} = 'succeeded'), 0)`,
          totalRemainingCents: sql<number>`coalesce(sum(${payments.amountCents}) filter (where ${payments.status} in ('pending', 'processing', 'failed', 'retried')), 0)`,
        })
        .from(payments)
        .innerJoin(plans, eq(payments.planId, plans.id))
        .where(eq(plans.clientId, ctx.clientId)),

      // Count active plans
      ctx.db
        .select({
          activePlans: sql<number>`count(*) filter (where ${plans.status} in ('active', 'deposit_paid'))`,
          totalPlans: sql<number>`count(*)`,
        })
        .from(plans)
        .where(eq(plans.clientId, ctx.clientId)),
    ]);

    const [nextPayment] = nextPaymentResult;
    const [totals] = totalsResult;
    const [planCounts] = planCountsResult;

    return {
      nextPayment: nextPayment ?? null,
      totalPaidCents: Number(totals?.totalPaidCents ?? 0),
      totalRemainingCents: Number(totals?.totalRemainingCents ?? 0),
      activePlans: Number(planCounts?.activePlans ?? 0),
      totalPlans: Number(planCounts?.totalPlans ?? 0),
    };
  }),

  // ── Pet CRUD ─────────────────────────────────────────────────────────

  /**
   * Get all pets for the authenticated owner.
   */
  getPets: clientProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: pets.id,
        name: pets.name,
        species: pets.species,
        breed: pets.breed,
        age: pets.age,
        createdAt: pets.createdAt,
        updatedAt: pets.updatedAt,
      })
      .from(pets)
      .where(eq(pets.clientId, ctx.clientId))
      .orderBy(pets.createdAt);
  }),

  /**
   * Add a new pet for the authenticated owner.
   */
  addPet: clientProcedure
    .input(
      z.object({
        name: z.string().min(1, 'Pet name is required').max(100),
        species: z.enum(['dog', 'cat', 'other']),
        breed: z.string().max(100).optional(),
        age: z.number().int().min(0).max(50).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [pet] = await ctx.db
        .insert(pets)
        .values({
          clientId: ctx.clientId,
          name: input.name,
          species: input.species,
          breed: input.breed ?? null,
          age: input.age ?? null,
        })
        .returning({
          id: pets.id,
          name: pets.name,
          species: pets.species,
          breed: pets.breed,
          age: pets.age,
          createdAt: pets.createdAt,
          updatedAt: pets.updatedAt,
        });

      await logAuditEvent({
        entityType: 'owner',
        entityId: ctx.clientId,
        action: 'created',
        oldValue: null,
        newValue: { petId: pet.id, name: input.name, species: input.species },
        actorType: 'client',
        actorId: ctx.clientId,
      });

      return pet;
    }),

  /**
   * Update an existing pet (validates ownership).
   */
  updatePet: clientProcedure
    .input(
      z.object({
        petId: z.string().uuid(),
        name: z.string().min(1, 'Pet name is required').max(100).optional(),
        species: z.enum(['dog', 'cat', 'other']).optional(),
        breed: z.string().max(100).optional(),
        age: z.number().int().min(0).max(50).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const [existing] = await ctx.db
        .select({ id: pets.id, ownerId: pets.clientId })
        .from(pets)
        .where(eq(pets.id, input.petId))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Pet not found' });
      }

      if (existing.ownerId !== ctx.clientId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not own this pet' });
      }

      const updateData: Record<string, string | number | null> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.species !== undefined) updateData.species = input.species;
      if (input.breed !== undefined) updateData.breed = input.breed;
      if (input.age !== undefined) updateData.age = input.age;

      if (Object.keys(updateData).length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No fields to update' });
      }

      const [updated] = await ctx.db
        .update(pets)
        .set(updateData)
        .where(eq(pets.id, input.petId))
        .returning({
          id: pets.id,
          name: pets.name,
          species: pets.species,
          breed: pets.breed,
          age: pets.age,
          createdAt: pets.createdAt,
          updatedAt: pets.updatedAt,
        });

      return updated;
    }),

  /**
   * Remove a pet (validates ownership).
   */
  removePet: clientProcedure
    .input(
      z.object({
        petId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const [existing] = await ctx.db
        .select({ id: pets.id, ownerId: pets.clientId, name: pets.name })
        .from(pets)
        .where(eq(pets.id, input.petId))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Pet not found' });
      }

      if (existing.ownerId !== ctx.clientId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not own this pet' });
      }

      await ctx.db.delete(pets).where(eq(pets.id, input.petId));

      await logAuditEvent({
        entityType: 'owner',
        entityId: ctx.clientId,
        action: 'status_changed',
        oldValue: { petId: existing.id, name: existing.name },
        newValue: null,
        actorType: 'client',
        actorId: ctx.clientId,
      });

      return { success: true as const };
    }),
});
