import { z } from 'zod';
import {
  createClinicReferral,
  getClinicReferralCode,
  getClinicReferrals,
} from '@/server/services/clinic-referral';
import { enrollAsFoundingClinic, getFoundingClinicStatus } from '@/server/services/founding-clinic';
import { getOrCreateOwnerReferralCode, getOwnerReferrals } from '@/server/services/owner-referral';
import { clinicProcedure, ownerProcedure, router } from '@/server/trpc';

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

  // ── Owner Referrals ──────────────────────────────────────────────────

  getMyOwnerReferralCode: ownerProcedure.query(async ({ ctx }) => {
    if (!ctx.ownerId) throw new Error('Owner ID required');
    return getOrCreateOwnerReferralCode(ctx.ownerId);
  }),

  getMyOwnerReferrals: ownerProcedure.query(async ({ ctx }) => {
    if (!ctx.ownerId) throw new Error('Owner ID required');
    return getOwnerReferrals(ctx.ownerId);
  }),
});
