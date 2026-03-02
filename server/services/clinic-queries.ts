// ── Clinic query service ─────────────────────────────────────────────
// Standalone query functions extracted from the tRPC clinic router.
// Shared by both tRPC (internal) and Hono REST (external) APIs.

import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import { generateCsv } from '@/lib/utils/csv';
import { formatCents } from '@/lib/utils/money';
import { escapeIlike } from '@/lib/utils/sql';
import { db } from '@/server/db';
import { clinics, owners, payments, payouts, plans } from '@/server/db/schema';

// ── Profile ──────────────────────────────────────────────────────────

export async function getClinicProfile(clinicId: string) {
  const [clinic] = await db
    .select({
      id: clinics.id,
      name: clinics.name,
      email: clinics.email,
      phone: clinics.phone,
      addressLine1: clinics.addressLine1,
      addressCity: clinics.addressCity,
      addressState: clinics.addressState,
      addressZip: clinics.addressZip,
      stripeAccountId: clinics.stripeAccountId,
      status: clinics.status,
    })
    .from(clinics)
    .where(eq(clinics.id, clinicId))
    .limit(1);

  return clinic ?? null;
}

export async function updateClinicProfile(
  clinicId: string,
  data: {
    name?: string;
    phone?: string;
    addressLine1?: string;
    addressCity?: string;
    addressState?: string;
    addressZip?: string;
  },
) {
  const updateData: Record<string, string> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.addressLine1 !== undefined) updateData.addressLine1 = data.addressLine1;
  if (data.addressCity !== undefined) updateData.addressCity = data.addressCity;
  if (data.addressState !== undefined) updateData.addressState = data.addressState.toUpperCase();
  if (data.addressZip !== undefined) updateData.addressZip = data.addressZip;

  if (Object.keys(updateData).length === 0) {
    return null;
  }

  const [updated] = await db
    .update(clinics)
    .set(updateData)
    .where(eq(clinics.id, clinicId))
    .returning({
      id: clinics.id,
      name: clinics.name,
      email: clinics.email,
      phone: clinics.phone,
      addressLine1: clinics.addressLine1,
      addressCity: clinics.addressCity,
      addressState: clinics.addressState,
      addressZip: clinics.addressZip,
      stripeAccountId: clinics.stripeAccountId,
      status: clinics.status,
    });

  return updated ?? null;
}

// ── Dashboard stats ──────────────────────────────────────────────────

export async function getDashboardStats(clinicId: string) {
  const [planCounts, earningsResult, pendingPayoutsResult, recentEnrollments] = await Promise.all([
    db
      .select({
        activePlans: sql<number>`count(*) filter (where ${plans.status} in ('active', 'deposit_paid'))`,
        completedPlans: sql<number>`count(*) filter (where ${plans.status} = 'completed')`,
        defaultedPlans: sql<number>`count(*) filter (where ${plans.status} = 'defaulted')`,
        totalPlans: sql<number>`count(*)`,
      })
      .from(plans)
      .where(eq(plans.clinicId, clinicId)),

    db
      .select({
        totalRevenueCents: sql<number>`coalesce(sum(${payouts.clinicShareCents}), 0)`,
        totalPayoutCents: sql<number>`coalesce(sum(${payouts.amountCents}), 0)`,
      })
      .from(payouts)
      .where(and(eq(payouts.clinicId, clinicId), eq(payouts.status, 'succeeded'))),

    db
      .select({
        pendingCount: sql<number>`count(*)`,
        pendingAmountCents: sql<number>`coalesce(sum(${payouts.amountCents}), 0)`,
      })
      .from(payouts)
      .where(and(eq(payouts.clinicId, clinicId), eq(payouts.status, 'pending'))),

    db
      .select({
        id: plans.id,
        ownerName: owners.name,
        petName: owners.petName,
        totalBillCents: plans.totalBillCents,
        status: plans.status,
        createdAt: plans.createdAt,
      })
      .from(plans)
      .leftJoin(owners, eq(plans.ownerId, owners.id))
      .where(eq(plans.clinicId, clinicId))
      .orderBy(desc(plans.createdAt))
      .limit(10),
  ]);

  return {
    activePlans: Number(planCounts[0]?.activePlans ?? 0),
    completedPlans: Number(planCounts[0]?.completedPlans ?? 0),
    defaultedPlans: Number(planCounts[0]?.defaultedPlans ?? 0),
    totalPlans: Number(planCounts[0]?.totalPlans ?? 0),
    totalRevenueCents: Number(earningsResult[0]?.totalRevenueCents ?? 0),
    totalPayoutCents: Number(earningsResult[0]?.totalPayoutCents ?? 0),
    pendingPayoutsCount: Number(pendingPayoutsResult[0]?.pendingCount ?? 0),
    pendingPayoutsCents: Number(pendingPayoutsResult[0]?.pendingAmountCents ?? 0),
    recentEnrollments,
  };
}

// ── Client stats ─────────────────────────────────────────────────────

export async function getClientStats(clinicId: string) {
  const [planResult, paidResult] = await Promise.all([
    db
      .select({
        activePlans: sql<number>`count(*) filter (where ${plans.status} in ('active', 'deposit_paid'))`,
        activeTotalCents: sql<number>`coalesce(sum(${plans.totalWithFeeCents}) filter (where ${plans.status} in ('active', 'deposit_paid')), 0)`,
        totalPlans: sql<number>`count(*)`,
        defaultedPlans: sql<number>`count(*) filter (where ${plans.status} = 'defaulted')`,
      })
      .from(plans)
      .where(eq(plans.clinicId, clinicId)),

    db
      .select({
        paidCents: sql<number>`coalesce(sum(${payments.amountCents}), 0)`,
      })
      .from(payments)
      .innerJoin(plans, eq(payments.planId, plans.id))
      .where(
        and(
          eq(plans.clinicId, clinicId),
          sql`${plans.status} in ('active', 'deposit_paid')`,
          eq(payments.status, 'succeeded'),
        ),
      ),
  ]);

  const activeTotalCents = Number(planResult[0]?.activeTotalCents ?? 0);
  const paidCents = Number(paidResult[0]?.paidCents ?? 0);
  const total = Number(planResult[0]?.totalPlans ?? 0);
  const defaulted = Number(planResult[0]?.defaultedPlans ?? 0);
  const defaultRate = total > 0 ? (defaulted / total) * 100 : 0;

  return {
    activePlans: Number(planResult[0]?.activePlans ?? 0),
    totalOutstandingCents: Math.max(0, activeTotalCents - paidCents),
    defaultRate: Math.round(defaultRate * 100) / 100,
  };
}

// ── Clients list ─────────────────────────────────────────────────────

export async function getClients(
  clinicId: string,
  params: {
    search?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  },
) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(plans.clinicId, clinicId)];

  if (params.status) {
    // biome-ignore lint/suspicious/noExplicitAny: status is validated at the API layer
    conditions.push(eq(plans.status, params.status as any));
  }

  if (params.search) {
    const searchPattern = `%${escapeIlike(params.search)}%`;
    const searchCondition = or(
      ilike(owners.name, searchPattern),
      ilike(owners.petName, searchPattern),
    );
    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  const whereClause = and(...conditions);

  const [clientRows, countResult] = await Promise.all([
    db
      .select({
        planId: plans.id,
        ownerName: owners.name,
        ownerEmail: owners.email,
        ownerPhone: owners.phone,
        petName: owners.petName,
        totalBillCents: plans.totalBillCents,
        totalWithFeeCents: plans.totalWithFeeCents,
        planStatus: plans.status,
        nextPaymentAt: plans.nextPaymentAt,
        createdAt: plans.createdAt,
        totalPaidCents: sql<number>`coalesce(sum(${payments.amountCents}) filter (where ${payments.status} = 'succeeded'), 0)`,
      })
      .from(plans)
      .leftJoin(owners, eq(plans.ownerId, owners.id))
      .leftJoin(payments, eq(plans.id, payments.planId))
      .where(whereClause)
      .groupBy(plans.id, owners.id)
      .orderBy(desc(plans.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)` })
      .from(plans)
      .leftJoin(owners, eq(plans.ownerId, owners.id))
      .where(whereClause),
  ]);

  const totalCount = Number(countResult[0]?.total ?? 0);
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    clients: clientRows.map((row) => ({
      ...row,
      totalPaidCents: Number(row.totalPaidCents),
    })),
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
    },
  };
}

// ── Client details ───────────────────────────────────────────────────

export async function getClientDetails(clinicId: string, planId: string) {
  const [seedPlan] = await db
    .select({ ownerId: plans.ownerId })
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.clinicId, clinicId)))
    .limit(1);

  if (!seedPlan || !seedPlan.ownerId) {
    return null;
  }

  const [owner] = await db
    .select({
      id: owners.id,
      name: owners.name,
      email: owners.email,
      phone: owners.phone,
      petName: owners.petName,
    })
    .from(owners)
    .where(eq(owners.id, seedPlan.ownerId))
    .limit(1);

  if (!owner) {
    return null;
  }

  const clientPlans = await db
    .select({
      id: plans.id,
      totalBillCents: plans.totalBillCents,
      totalWithFeeCents: plans.totalWithFeeCents,
      depositCents: plans.depositCents,
      installmentCents: plans.installmentCents,
      numInstallments: plans.numInstallments,
      status: plans.status,
      createdAt: plans.createdAt,
      petName: owners.petName,
      totalPaidCents: sql<number>`coalesce(sum(${payments.amountCents}) filter (where ${payments.status} = 'succeeded'), 0)`,
    })
    .from(plans)
    .leftJoin(owners, eq(plans.ownerId, owners.id))
    .leftJoin(payments, eq(plans.id, payments.planId))
    .where(and(eq(plans.ownerId, seedPlan.ownerId), eq(plans.clinicId, clinicId)))
    .groupBy(plans.id, owners.id)
    .orderBy(desc(plans.createdAt));

  return {
    owner: {
      name: owner.name,
      email: owner.email,
      phone: owner.phone,
      petName: owner.petName,
    },
    plans: clientPlans.map((p) => ({
      ...p,
      totalPaidCents: Number(p.totalPaidCents),
    })),
    clientSince: clientPlans.at(-1)?.createdAt ?? null,
  };
}

// ── Client plan details ──────────────────────────────────────────────

export async function getClientPlanDetails(clinicId: string, planId: string) {
  const [plan] = await db
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
      depositPaidAt: plans.depositPaidAt,
      nextPaymentAt: plans.nextPaymentAt,
      completedAt: plans.completedAt,
      createdAt: plans.createdAt,
      ownerName: owners.name,
      ownerEmail: owners.email,
      ownerPhone: owners.phone,
      petName: owners.petName,
    })
    .from(plans)
    .leftJoin(owners, eq(plans.ownerId, owners.id))
    .where(and(eq(plans.id, planId), eq(plans.clinicId, clinicId)))
    .limit(1);

  if (!plan) {
    return null;
  }

  const [planPayments, planPayouts] = await Promise.all([
    db
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
      .where(eq(payments.planId, planId))
      .orderBy(payments.sequenceNum),

    db
      .select({
        id: payouts.id,
        amountCents: payouts.amountCents,
        clinicShareCents: payouts.clinicShareCents,
        stripeTransferId: payouts.stripeTransferId,
        status: payouts.status,
        createdAt: payouts.createdAt,
      })
      .from(payouts)
      .where(and(eq(payouts.planId, planId), eq(payouts.clinicId, clinicId)))
      .orderBy(desc(payouts.createdAt)),
  ]);

  return { plan, payments: planPayments, payouts: planPayouts };
}

// ── Revenue ──────────────────────────────────────────────────────────

export async function getMonthlyRevenue(clinicId: string) {
  const monthlyData = await db
    .select({
      month: sql<string>`to_char(${payouts.createdAt}, 'YYYY-MM')`,
      totalPayoutCents: sql<number>`coalesce(sum(${payouts.amountCents}), 0)`,
      totalShareCents: sql<number>`coalesce(sum(${payouts.clinicShareCents}), 0)`,
      payoutCount: sql<number>`count(*)`,
    })
    .from(payouts)
    .where(
      and(
        eq(payouts.clinicId, clinicId),
        eq(payouts.status, 'succeeded'),
        sql`${payouts.createdAt} >= now() - interval '12 months'`,
      ),
    )
    .groupBy(sql`to_char(${payouts.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${payouts.createdAt}, 'YYYY-MM')`);

  return monthlyData.map((row) => ({
    month: row.month,
    totalPayoutCents: Number(row.totalPayoutCents),
    totalShareCents: Number(row.totalShareCents),
    payoutCount: Number(row.payoutCount),
  }));
}

export async function getRevenueReport(clinicId: string, dateFrom: Date, dateTo: Date) {
  const revenueData = await db
    .select({
      month: sql<string>`to_char(${payouts.createdAt}, 'YYYY-MM')`,
      revenueCents: sql<number>`coalesce(sum(${payouts.amountCents}), 0)`,
      clinicShareCents: sql<number>`coalesce(sum(${payouts.clinicShareCents}), 0)`,
      payoutCount: sql<number>`count(*)`,
    })
    .from(payouts)
    .where(
      and(
        eq(payouts.clinicId, clinicId),
        eq(payouts.status, 'succeeded'),
        gte(payouts.createdAt, dateFrom),
        lte(payouts.createdAt, dateTo),
      ),
    )
    .groupBy(sql`to_char(${payouts.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${payouts.createdAt}, 'YYYY-MM')`);

  const enrollmentData = await db
    .select({
      month: sql<string>`to_char(${plans.createdAt}, 'YYYY-MM')`,
      enrollments: sql<number>`count(*)`,
    })
    .from(plans)
    .where(
      and(
        eq(plans.clinicId, clinicId),
        gte(plans.createdAt, dateFrom),
        lte(plans.createdAt, dateTo),
      ),
    )
    .groupBy(sql`to_char(${plans.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${plans.createdAt}, 'YYYY-MM')`);

  const enrollmentMap = new Map(enrollmentData.map((e) => [e.month, Number(e.enrollments)]));
  const allMonths = new Set<string>();
  for (const r of revenueData) allMonths.add(r.month);
  for (const e of enrollmentData) allMonths.add(e.month);
  const sortedMonths = [...allMonths].sort();

  const revenueMap = new Map(
    revenueData.map((r) => [
      r.month,
      {
        revenueCents: Number(r.revenueCents),
        clinicShareCents: Number(r.clinicShareCents),
        payoutCount: Number(r.payoutCount),
      },
    ]),
  );

  return sortedMonths.map((month) => ({
    month,
    enrollments: enrollmentMap.get(month) ?? 0,
    revenueCents: revenueMap.get(month)?.revenueCents ?? 0,
    payoutsCents: revenueMap.get(month)?.revenueCents ?? 0,
    clinicShareCents: revenueMap.get(month)?.clinicShareCents ?? 0,
  }));
}

// ── Enrollment trends ────────────────────────────────────────────────

export async function getEnrollmentTrends(clinicId: string, months = 12) {
  const trendData = await db
    .select({
      month: sql<string>`to_char(${plans.createdAt}, 'YYYY-MM')`,
      enrollments: sql<number>`count(*)`,
    })
    .from(plans)
    .where(
      and(
        eq(plans.clinicId, clinicId),
        sql`${plans.createdAt} >= now() - make_interval(months => ${months})`,
      ),
    )
    .groupBy(sql`to_char(${plans.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${plans.createdAt}, 'YYYY-MM')`);

  return trendData.map((row) => ({
    month: row.month,
    enrollments: Number(row.enrollments),
  }));
}

// ── Default rate ─────────────────────────────────────────────────────

export async function getDefaultRate(clinicId: string) {
  const [result] = await db
    .select({
      totalPlans: sql<number>`count(*)`,
      defaultedPlans: sql<number>`count(*) filter (where ${plans.status} = 'defaulted')`,
    })
    .from(plans)
    .where(eq(plans.clinicId, clinicId));

  const total = Number(result?.totalPlans ?? 0);
  const defaulted = Number(result?.defaultedPlans ?? 0);
  const rate = total > 0 ? (defaulted / total) * 100 : 0;

  return {
    totalPlans: total,
    defaultedPlans: defaulted,
    defaultRate: Math.round(rate * 100) / 100,
  };
}

// ── CSV exports ──────────────────────────────────────────────────────

export async function exportClientsCSV(clinicId: string) {
  const clientRows = await db
    .select({
      ownerName: owners.name,
      ownerEmail: owners.email,
      petName: owners.petName,
      planStatus: plans.status,
      totalBillCents: plans.totalBillCents,
      totalPaidCents: sql<number>`coalesce(sum(${payments.amountCents}) filter (where ${payments.status} = 'succeeded'), 0)`,
      remainingCents: plans.remainingCents,
    })
    .from(plans)
    .leftJoin(owners, eq(plans.ownerId, owners.id))
    .leftJoin(payments, eq(plans.id, payments.planId))
    .where(eq(plans.clinicId, clinicId))
    .groupBy(plans.id, owners.id)
    .orderBy(desc(plans.createdAt))
    .limit(10000);

  const headers = [
    'Owner Name',
    'Email',
    'Pet Name',
    'Plan Status',
    'Total Bill',
    'Paid Amount',
    'Remaining',
  ];

  const rows = clientRows.map((row) => [
    row.ownerName ?? '',
    row.ownerEmail ?? '',
    row.petName ?? '',
    row.planStatus ?? '',
    formatCents(row.totalBillCents),
    formatCents(Number(row.totalPaidCents)),
    formatCents(row.remainingCents),
  ]);

  return { csv: generateCsv(headers, rows) };
}

export async function exportRevenueCSV(clinicId: string, dateFrom: Date, dateTo: Date) {
  const revenueData = await db
    .select({
      month: sql<string>`to_char(${payouts.createdAt}, 'YYYY-MM')`,
      revenueCents: sql<number>`coalesce(sum(${payouts.amountCents}), 0)`,
      clinicShareCents: sql<number>`coalesce(sum(${payouts.clinicShareCents}), 0)`,
      payoutCount: sql<number>`count(*)`,
    })
    .from(payouts)
    .where(
      and(
        eq(payouts.clinicId, clinicId),
        eq(payouts.status, 'succeeded'),
        gte(payouts.createdAt, dateFrom),
        lte(payouts.createdAt, dateTo),
      ),
    )
    .groupBy(sql`to_char(${payouts.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${payouts.createdAt}, 'YYYY-MM')`);

  const headers = ['Month', 'Revenue', 'Clinic Share', 'Payouts'];
  const rows = revenueData.map((row) => [
    row.month,
    formatCents(Number(row.revenueCents)),
    formatCents(Number(row.clinicShareCents)),
    Number(row.payoutCount),
  ]);

  return { csv: generateCsv(headers, rows) };
}

export async function exportPayoutsCSV(clinicId: string) {
  const payoutRows = await db
    .select({
      payoutId: payouts.id,
      amountCents: payouts.amountCents,
      clinicShareCents: payouts.clinicShareCents,
      status: payouts.status,
      stripeTransferId: payouts.stripeTransferId,
      createdAt: payouts.createdAt,
      ownerName: owners.name,
      petName: owners.petName,
    })
    .from(payouts)
    .leftJoin(plans, eq(payouts.planId, plans.id))
    .leftJoin(owners, eq(plans.ownerId, owners.id))
    .where(eq(payouts.clinicId, clinicId))
    .orderBy(desc(payouts.createdAt))
    .limit(10000);

  const headers = [
    'Payout ID',
    'Owner',
    'Pet',
    'Amount',
    'Clinic Share',
    'Status',
    'Stripe Transfer',
    'Date',
  ];

  const rows = payoutRows.map((row) => [
    row.payoutId,
    row.ownerName ?? '',
    row.petName ?? '',
    formatCents(row.amountCents),
    formatCents(row.clinicShareCents),
    row.status,
    row.stripeTransferId ?? '',
    row.createdAt ? new Date(row.createdAt).toISOString() : '',
  ]);

  return { csv: generateCsv(headers, rows) };
}
