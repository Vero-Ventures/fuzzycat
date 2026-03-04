import { z } from 'zod';
import {
  getClientReferrals,
  getOrCreateClientReferralCode,
} from '@/server/services/client-referral';
import {
  createClinicReferral,
  getClinicReferralCode,
  getClinicReferrals,
} from '@/server/services/clinic-referral';
import { enrollAsFoundingClinic, getFoundingClinicStatus } from '@/server/services/founding-clinic';
import { clientProcedure, clinicProcedure, router } from '@/server/trpc';

export const growthRouter = router({
  // ── Founding Clinic ──────────────────────────────────────────────────

  getFoundingClinicStatus: clinicProcedure.query(async ({ ctx }) => {
    if (!ctx.clinicId) throw new Error('Clinic ID required');
    return getFoundingClinicStatus(ctx.clinicId);
  }),

  enrollFoundingClinic: clinicProcedure.mutation(async ({ ctx }) => {
    if (!ctx.clinicId) throw new Error('Clinic ID required');
    return enrollAsFoundingClinic(ctx.clinicId);
  }),

  // ── Clinic Referrals ─────────────────────────────────────────────────

  getMyReferralCode: clinicProcedure.query(async ({ ctx }) => {
    if (!ctx.clinicId) throw new Error('Clinic ID required');
    return getClinicReferralCode(ctx.clinicId);
  }),

  createClinicReferral: clinicProcedure
    .input(z.object({ referredEmail: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.clinicId) throw new Error('Clinic ID required');
      return createClinicReferral(ctx.clinicId, input.referredEmail);
    }),

  getMyClinicReferrals: clinicProcedure.query(async ({ ctx }) => {
    if (!ctx.clinicId) throw new Error('Clinic ID required');
    return getClinicReferrals(ctx.clinicId);
  }),

  // ── Client Referrals ─────────────────────────────────────────────────

  getMyClientReferralCode: clientProcedure.query(async ({ ctx }) => {
    if (!ctx.clientId) throw new Error('Client ID required');
    return getOrCreateClientReferralCode(ctx.clientId);
  }),

  getMyClientReferrals: clientProcedure.query(async ({ ctx }) => {
    if (!ctx.clientId) throw new Error('Client ID required');
    return getClientReferrals(ctx.clientId);
  }),
});
