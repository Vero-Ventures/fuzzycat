/**
 * Centralized realistic mock responses for every tRPC query used in the UI audit.
 * Organized by portal (owner, clinic, admin, enrollment, payout).
 */

// ─── Owner Portal ────────────────────────────────────────────────────────────

export const ownerDashboardSummary = {
  nextPayment: {
    id: 'pay-next-001',
    planId: 'plan-owner-001',
    amountCents: 10600,
    scheduledAt: '2026-03-06T00:00:00.000Z',
    type: 'installment' as const,
    sequenceNum: 3,
  },
  totalPaidCents: 42400,
  totalRemainingCents: 84800,
  activePlans: 1,
  totalPlans: 2,
};

export const ownerPlans = [
  {
    id: 'plan-owner-001',
    clinicId: 'clinic-001',
    totalBillCents: 120000,
    feeCents: 7200,
    totalWithFeeCents: 127200,
    depositCents: 31800,
    remainingCents: 84800,
    installmentCents: 10600,
    numInstallments: 6,
    status: 'active',
    nextPaymentAt: '2026-03-06T00:00:00.000Z',
    depositPaidAt: '2026-01-15T00:00:00.000Z',
    completedAt: null,
    createdAt: '2026-01-15T00:00:00.000Z',
    clinicName: 'Happy Paws Veterinary',
    succeededCount: 2,
    totalPaidCents: 42400,
    totalPayments: 7,
  },
  {
    id: 'plan-owner-002',
    clinicId: 'clinic-002',
    totalBillCents: 80000,
    feeCents: 4800,
    totalWithFeeCents: 84800,
    depositCents: 21200,
    remainingCents: 0,
    installmentCents: 10600,
    numInstallments: 6,
    status: 'completed',
    nextPaymentAt: null,
    depositPaidAt: '2025-09-01T00:00:00.000Z',
    completedAt: '2025-12-15T00:00:00.000Z',
    createdAt: '2025-09-01T00:00:00.000Z',
    clinicName: 'Whisker Wellness Clinic',
    succeededCount: 7,
    totalPaidCents: 84800,
    totalPayments: 7,
  },
];

export const ownerPaymentHistory = {
  payments: [
    {
      id: 'pay-001',
      type: 'deposit' as const,
      sequenceNum: null,
      amountCents: 31800,
      status: 'succeeded' as const,
      scheduledAt: '2026-01-15T00:00:00.000Z',
      processedAt: '2026-01-15T12:00:00.000Z',
      failureReason: null,
      retryCount: null,
    },
    {
      id: 'pay-002',
      type: 'installment' as const,
      sequenceNum: 1,
      amountCents: 10600,
      status: 'succeeded' as const,
      scheduledAt: '2026-01-29T00:00:00.000Z',
      processedAt: '2026-01-29T12:00:00.000Z',
      failureReason: null,
      retryCount: null,
    },
    {
      id: 'pay-003',
      type: 'installment' as const,
      sequenceNum: 2,
      amountCents: 10600,
      status: 'succeeded' as const,
      scheduledAt: '2026-02-12T00:00:00.000Z',
      processedAt: '2026-02-12T12:00:00.000Z',
      failureReason: null,
      retryCount: null,
    },
    {
      id: 'pay-004',
      type: 'installment' as const,
      sequenceNum: 3,
      amountCents: 10600,
      status: 'pending' as const,
      scheduledAt: '2026-03-06T00:00:00.000Z',
      processedAt: null,
      failureReason: null,
      retryCount: null,
    },
    {
      id: 'pay-005',
      type: 'installment' as const,
      sequenceNum: 4,
      amountCents: 10600,
      status: 'failed' as const,
      scheduledAt: '2026-02-26T00:00:00.000Z',
      processedAt: '2026-02-26T12:00:00.000Z',
      failureReason: 'Insufficient funds',
      retryCount: 1,
    },
  ],
  pagination: {
    page: 1,
    pageSize: 10,
    totalCount: 5,
    totalPages: 1,
  },
};

export const ownerProfile = {
  id: 'owner-001',
  name: 'Jane Doe',
  email: 'jane.doe@example.com',
  phone: '+15551234567',
  petName: 'Whiskers',
  paymentMethod: 'debit_card' as const,
  stripeCardPaymentMethodId: 'pm_card_mock_001',
  stripeAchPaymentMethodId: null,
  addressLine1: '123 Pet Lane',
  addressCity: 'San Francisco',
  addressState: 'CA',
  addressZip: '94102',
};

// ─── Enrollment ──────────────────────────────────────────────────────────────

export const enrollmentSummary = {
  plan: {
    id: 'plan-new-001',
    status: 'deposit_paid',
    totalBillCents: 150000,
    feeCents: 9000,
    totalWithFeeCents: 159000,
    depositCents: 39750,
    remainingCents: 119250,
    installmentCents: 19875,
    numInstallments: 6,
    createdAt: '2026-02-20T00:00:00.000Z',
  },
  owner: {
    id: 'owner-001',
    name: 'Jane Doe',
    email: 'jane.doe@example.com',
    phone: '+15551234567',
    petName: 'Whiskers',
  },
  clinic: {
    id: 'clinic-001',
    name: 'Happy Paws Veterinary',
  },
  payments: [
    {
      id: 'pay-new-001',
      type: 'deposit' as const,
      sequenceNum: null,
      amountCents: 39750,
      status: 'succeeded',
      scheduledAt: '2026-02-20T00:00:00.000Z',
    },
    {
      id: 'pay-new-002',
      type: 'installment' as const,
      sequenceNum: 1,
      amountCents: 19875,
      status: 'pending',
      scheduledAt: '2026-03-06T00:00:00.000Z',
    },
    {
      id: 'pay-new-003',
      type: 'installment' as const,
      sequenceNum: 2,
      amountCents: 19875,
      status: 'pending',
      scheduledAt: '2026-03-20T00:00:00.000Z',
    },
    {
      id: 'pay-new-004',
      type: 'installment' as const,
      sequenceNum: 3,
      amountCents: 19875,
      status: 'pending',
      scheduledAt: '2026-04-03T00:00:00.000Z',
    },
    {
      id: 'pay-new-005',
      type: 'installment' as const,
      sequenceNum: 4,
      amountCents: 19875,
      status: 'pending',
      scheduledAt: '2026-04-17T00:00:00.000Z',
    },
    {
      id: 'pay-new-006',
      type: 'installment' as const,
      sequenceNum: 5,
      amountCents: 19875,
      status: 'pending',
      scheduledAt: '2026-05-01T00:00:00.000Z',
    },
    {
      id: 'pay-new-007',
      type: 'installment' as const,
      sequenceNum: 6,
      amountCents: 19875,
      status: 'pending',
      scheduledAt: '2026-05-15T00:00:00.000Z',
    },
  ],
};

export const clinicSearch = [
  {
    id: 'clinic-001',
    name: 'Happy Paws Veterinary',
    addressCity: 'San Francisco',
    addressState: 'CA',
  },
  {
    id: 'clinic-002',
    name: 'Whisker Wellness Clinic',
    addressCity: 'Oakland',
    addressState: 'CA',
  },
];

// ─── Clinic Portal ───────────────────────────────────────────────────────────

export const clinicDashboardStats = {
  activePlans: 12,
  completedPlans: 45,
  defaultedPlans: 2,
  totalPlans: 59,
  totalRevenueCents: 2340000,
  totalPayoutCents: 7560000,
  pendingPayoutsCount: 3,
  pendingPayoutsCents: 318000,
  recentEnrollments: [
    {
      id: 'plan-c-001',
      ownerName: 'Jane Doe',
      petName: 'Whiskers',
      totalBillCents: 120000,
      status: 'active',
      createdAt: '2026-02-18T00:00:00.000Z',
    },
    {
      id: 'plan-c-002',
      ownerName: 'John Smith',
      petName: 'Buddy',
      totalBillCents: 85000,
      status: 'active',
      createdAt: '2026-02-15T00:00:00.000Z',
    },
    {
      id: 'plan-c-003',
      ownerName: 'Alice Johnson',
      petName: 'Luna',
      totalBillCents: 200000,
      status: 'deposit_paid',
      createdAt: '2026-02-20T00:00:00.000Z',
    },
  ],
};

export const clinicMonthlyRevenue = [
  { month: '2025-03', totalPayoutCents: 540000, totalShareCents: 21600, payoutCount: 8 },
  { month: '2025-04', totalPayoutCents: 620000, totalShareCents: 24800, payoutCount: 10 },
  { month: '2025-05', totalPayoutCents: 580000, totalShareCents: 23200, payoutCount: 9 },
  { month: '2025-06', totalPayoutCents: 710000, totalShareCents: 28400, payoutCount: 11 },
  { month: '2025-07', totalPayoutCents: 650000, totalShareCents: 26000, payoutCount: 10 },
  { month: '2025-08', totalPayoutCents: 590000, totalShareCents: 23600, payoutCount: 9 },
  { month: '2025-09', totalPayoutCents: 680000, totalShareCents: 27200, payoutCount: 11 },
  { month: '2025-10', totalPayoutCents: 720000, totalShareCents: 28800, payoutCount: 12 },
  { month: '2025-11', totalPayoutCents: 610000, totalShareCents: 24400, payoutCount: 10 },
  { month: '2025-12', totalPayoutCents: 750000, totalShareCents: 30000, payoutCount: 12 },
  { month: '2026-01', totalPayoutCents: 690000, totalShareCents: 27600, payoutCount: 11 },
  { month: '2026-02', totalPayoutCents: 420000, totalShareCents: 16800, payoutCount: 7 },
];

export const clinicClients = {
  clients: [
    {
      planId: 'plan-c-001',
      ownerName: 'Jane Doe',
      ownerEmail: 'jane.doe@example.com',
      ownerPhone: '+15551234567',
      petName: 'Whiskers',
      totalBillCents: 120000,
      totalWithFeeCents: 127200,
      planStatus: 'active',
      nextPaymentAt: '2026-03-06T00:00:00.000Z',
      createdAt: '2026-01-15T00:00:00.000Z',
      totalPaidCents: 42400,
    },
    {
      planId: 'plan-c-002',
      ownerName: 'John Smith',
      ownerEmail: 'john.smith@example.com',
      ownerPhone: '+15559876543',
      petName: 'Buddy',
      totalBillCents: 85000,
      totalWithFeeCents: 90100,
      planStatus: 'active',
      nextPaymentAt: '2026-03-01T00:00:00.000Z',
      createdAt: '2026-01-20T00:00:00.000Z',
      totalPaidCents: 22525,
    },
    {
      planId: 'plan-c-003',
      ownerName: 'Alice Johnson',
      ownerEmail: 'alice.j@example.com',
      ownerPhone: '+15555551234',
      petName: 'Luna',
      totalBillCents: 200000,
      totalWithFeeCents: 212000,
      planStatus: 'completed',
      nextPaymentAt: null,
      createdAt: '2025-08-01T00:00:00.000Z',
      totalPaidCents: 212000,
    },
    {
      planId: 'plan-c-004',
      ownerName: 'Bob Williams',
      ownerEmail: 'bob.w@example.com',
      ownerPhone: '+15553334444',
      petName: 'Max',
      totalBillCents: 60000,
      totalWithFeeCents: 63600,
      planStatus: 'defaulted',
      nextPaymentAt: null,
      createdAt: '2025-10-01T00:00:00.000Z',
      totalPaidCents: 31800,
    },
  ],
  pagination: {
    page: 1,
    pageSize: 20,
    totalCount: 4,
    totalPages: 1,
  },
};

export const clinicProfile = {
  id: 'clinic-001',
  name: 'Happy Paws Veterinary',
  email: 'info@happypaws.vet',
  phone: '+15559991234',
  addressLine1: '456 Vet Blvd',
  addressCity: 'San Francisco',
  addressState: 'CA',
  addressZip: '94103',
  stripeAccountId: 'acct_mock_stripe_001',
  status: 'active' as const,
};

export const clinicOnboardingStatus = {
  clinicId: 'clinic-001',
  clinicName: 'Happy Paws Veterinary',
  clinicStatus: 'active' as const,
  profileComplete: true,
  stripe: {
    status: 'active' as const,
    chargesEnabled: true,
    payoutsEnabled: true,
    accountId: 'acct_mock_stripe_001',
  },
  mfaEnabled: true,
  mfaRequired: true,
  allComplete: true,
};

export const clinicRevenueReport = [
  {
    month: '2026-01',
    enrollments: 5,
    revenueCents: 690000,
    payoutsCents: 652200,
    clinicShareCents: 27600,
  },
  {
    month: '2026-02',
    enrollments: 3,
    revenueCents: 420000,
    payoutsCents: 396900,
    clinicShareCents: 16800,
  },
];

export const clinicEnrollmentTrends = [
  { month: '2025-03', enrollments: 4 },
  { month: '2025-04', enrollments: 6 },
  { month: '2025-05', enrollments: 5 },
  { month: '2025-06', enrollments: 7 },
  { month: '2025-07', enrollments: 5 },
  { month: '2025-08', enrollments: 8 },
  { month: '2025-09', enrollments: 6 },
  { month: '2025-10', enrollments: 7 },
  { month: '2025-11', enrollments: 5 },
  { month: '2025-12', enrollments: 9 },
  { month: '2026-01', enrollments: 5 },
  { month: '2026-02', enrollments: 3 },
];

export const clinicDefaultRate = {
  totalPlans: 59,
  defaultedPlans: 2,
  defaultRate: 3.39,
};

// ─── Payout ──────────────────────────────────────────────────────────────────

export const payoutEarnings = {
  totalPayoutCents: 7560000,
  totalClinicShareCents: 302400,
  pendingPayoutCents: 318000,
  completedPayoutCount: 42,
};

export const payoutHistory = {
  payouts: [
    {
      id: 'payout-001',
      planId: 'plan-c-001',
      paymentId: 'pay-c-001',
      amountCents: 106000,
      clinicShareCents: 4240,
      stripeTransferId: 'tr_mock_001',
      status: 'succeeded' as const,
      createdAt: '2026-02-12T00:00:00.000Z',
    },
    {
      id: 'payout-002',
      planId: 'plan-c-002',
      paymentId: 'pay-c-002',
      amountCents: 75250,
      clinicShareCents: 3010,
      stripeTransferId: 'tr_mock_002',
      status: 'succeeded' as const,
      createdAt: '2026-02-10T00:00:00.000Z',
    },
    {
      id: 'payout-003',
      planId: 'plan-c-001',
      paymentId: 'pay-c-003',
      amountCents: 106000,
      clinicShareCents: 4240,
      stripeTransferId: null,
      status: 'pending' as const,
      createdAt: '2026-02-20T00:00:00.000Z',
    },
  ],
  total: 3,
};

// ─── Admin Portal ────────────────────────────────────────────────────────────

export const adminPlatformStats = {
  totalEnrollments: 234,
  activePlans: 87,
  completedPlans: 132,
  defaultedPlans: 15,
  totalRevenueCents: 45600000,
  totalFeesCents: 2736000,
  defaultRate: 6.41,
};

export const adminRiskPoolHealth = {
  balanceCents: 1250000,
  outstandingGuaranteesCents: 8700000,
  coverageRatio: 0.14,
  activePlanCount: 87,
};

export const adminRiskPoolBalance = {
  totalContributionsCents: 4560000,
  totalClaimsCents: 3150000,
  totalRecoveriesCents: 840000,
  balanceCents: 1250000,
};

export const adminRecentAuditLog = [
  {
    id: 'audit-001',
    entityType: 'plan',
    entityId: 'plan-c-004',
    action: 'status_changed',
    oldValue: JSON.stringify({ status: 'active' }),
    newValue: JSON.stringify({ status: 'defaulted' }),
    actorType: 'system' as const,
    actorId: null,
    createdAt: '2026-02-21T14:30:00.000Z',
  },
  {
    id: 'audit-002',
    entityType: 'payment',
    entityId: 'pay-fail-001',
    action: 'payment_retried',
    oldValue: JSON.stringify({ status: 'failed' }),
    newValue: JSON.stringify({ status: 'processing' }),
    actorType: 'admin' as const,
    actorId: 'admin-001',
    createdAt: '2026-02-21T10:15:00.000Z',
  },
  {
    id: 'audit-003',
    entityType: 'clinic',
    entityId: 'clinic-003',
    action: 'status_changed',
    oldValue: JSON.stringify({ status: 'pending' }),
    newValue: JSON.stringify({ status: 'active' }),
    actorType: 'admin' as const,
    actorId: 'admin-001',
    createdAt: '2026-02-20T16:00:00.000Z',
  },
  {
    id: 'audit-004',
    entityType: 'payout',
    entityId: 'payout-005',
    action: 'payout_created',
    oldValue: null,
    newValue: JSON.stringify({ amountCents: 106000, status: 'pending' }),
    actorType: 'system' as const,
    actorId: null,
    createdAt: '2026-02-20T12:00:00.000Z',
  },
  {
    id: 'audit-005',
    entityType: 'owner',
    entityId: 'owner-005',
    action: 'disclaimer_confirmed',
    oldValue: null,
    newValue: JSON.stringify({ confirmedAt: '2026-02-19T09:00:00.000Z' }),
    actorType: 'owner' as const,
    actorId: 'owner-005',
    createdAt: '2026-02-19T09:00:00.000Z',
  },
];

export const adminClinics = {
  clinics: [
    {
      id: 'clinic-001',
      name: 'Happy Paws Veterinary',
      email: 'info@happypaws.vet',
      status: 'active' as const,
      stripeAccountId: 'acct_mock_001',
      createdAt: '2025-06-01T00:00:00.000Z',
      enrollmentCount: 59,
      totalRevenueCents: 7560000,
      stripeConnected: true,
    },
    {
      id: 'clinic-002',
      name: 'Whisker Wellness Clinic',
      email: 'hello@whiskerwellness.com',
      status: 'active' as const,
      stripeAccountId: 'acct_mock_002',
      createdAt: '2025-07-15T00:00:00.000Z',
      enrollmentCount: 38,
      totalRevenueCents: 4200000,
      stripeConnected: true,
    },
    {
      id: 'clinic-003',
      name: 'PetCare Plus',
      email: 'admin@petcareplus.com',
      status: 'pending' as const,
      stripeAccountId: null,
      createdAt: '2026-02-10T00:00:00.000Z',
      enrollmentCount: 0,
      totalRevenueCents: 0,
      stripeConnected: false,
    },
    {
      id: 'clinic-004',
      name: 'Sunset Animal Hospital',
      email: 'contact@sunsetanimal.com',
      status: 'suspended' as const,
      stripeAccountId: 'acct_mock_004',
      createdAt: '2025-08-20T00:00:00.000Z',
      enrollmentCount: 12,
      totalRevenueCents: 960000,
      stripeConnected: true,
    },
  ],
  pagination: {
    limit: 20,
    offset: 0,
    totalCount: 4,
  },
};

export const adminPayments = {
  payments: [
    {
      id: 'apay-001',
      type: 'installment' as const,
      sequenceNum: 3,
      amountCents: 10600,
      status: 'failed' as const,
      retryCount: 2,
      scheduledAt: '2026-02-20T00:00:00.000Z',
      processedAt: '2026-02-20T12:00:00.000Z',
      failureReason: 'Insufficient funds',
      planId: 'plan-c-004',
      ownerName: 'Bob Williams',
      ownerEmail: 'bob.w@example.com',
      clinicName: 'Happy Paws Veterinary',
      clinicId: 'clinic-001',
    },
    {
      id: 'apay-002',
      type: 'deposit' as const,
      sequenceNum: null,
      amountCents: 39750,
      status: 'succeeded' as const,
      retryCount: null,
      scheduledAt: '2026-02-19T00:00:00.000Z',
      processedAt: '2026-02-19T12:00:00.000Z',
      failureReason: null,
      planId: 'plan-c-005',
      ownerName: 'Emily Chen',
      ownerEmail: 'emily.c@example.com',
      clinicName: 'Whisker Wellness Clinic',
      clinicId: 'clinic-002',
    },
    {
      id: 'apay-003',
      type: 'installment' as const,
      sequenceNum: 1,
      amountCents: 7525,
      status: 'succeeded' as const,
      retryCount: null,
      scheduledAt: '2026-02-18T00:00:00.000Z',
      processedAt: '2026-02-18T12:00:00.000Z',
      failureReason: null,
      planId: 'plan-c-002',
      ownerName: 'John Smith',
      ownerEmail: 'john.smith@example.com',
      clinicName: 'Happy Paws Veterinary',
      clinicId: 'clinic-001',
    },
  ],
  pagination: {
    limit: 20,
    offset: 0,
    totalCount: 3,
  },
};

export const adminRiskPoolDetails = {
  entries: [
    {
      id: 'rp-001',
      planId: 'plan-c-001',
      contributionCents: 1272,
      type: 'contribution' as const,
      createdAt: '2026-01-15T00:00:00.000Z',
    },
    {
      id: 'rp-002',
      planId: 'plan-c-004',
      contributionCents: 63600,
      type: 'claim' as const,
      createdAt: '2026-02-21T00:00:00.000Z',
    },
    {
      id: 'rp-003',
      planId: 'plan-c-004',
      contributionCents: 15900,
      type: 'recovery' as const,
      createdAt: '2026-02-22T00:00:00.000Z',
    },
  ],
  pagination: {
    limit: 20,
    offset: 0,
    totalCount: 3,
  },
};

export const adminSoftCollections = {
  collections: [
    {
      id: 'sc-001',
      planId: 'plan-c-004',
      stage: 'day_7_followup' as const,
      startedAt: '2026-02-14T00:00:00.000Z',
      lastEscalatedAt: '2026-02-21T00:00:00.000Z',
      nextEscalationAt: '2026-02-28T00:00:00.000Z',
      notes: 'Owner contacted, promised to pay by Friday',
      createdAt: '2026-02-14T00:00:00.000Z',
      ownerName: 'Bob Williams',
      ownerEmail: 'bob.w@example.com',
      petName: 'Max',
      clinicName: 'Happy Paws Veterinary',
      remainingCents: 31800,
    },
    {
      id: 'sc-002',
      planId: 'plan-c-010',
      stage: 'day_1_reminder' as const,
      startedAt: '2026-02-21T00:00:00.000Z',
      lastEscalatedAt: null,
      nextEscalationAt: '2026-02-28T00:00:00.000Z',
      notes: null,
      createdAt: '2026-02-21T00:00:00.000Z',
      ownerName: 'Sarah Lee',
      ownerEmail: 'sarah.l@example.com',
      petName: 'Mittens',
      clinicName: 'Whisker Wellness Clinic',
      remainingCents: 21200,
    },
  ],
  pagination: {
    limit: 20,
    offset: 0,
    totalCount: 2,
  },
};

export const adminDefaultedPlans = {
  plans: [
    {
      id: 'plan-c-004',
      totalBillCents: 60000,
      totalWithFeeCents: 63600,
      remainingCents: 31800,
      createdAt: '2025-10-01T00:00:00.000Z',
      updatedAt: '2026-02-21T00:00:00.000Z',
      ownerName: 'Bob Williams',
      ownerEmail: 'bob.w@example.com',
      ownerPhone: '+15553334444',
      petName: 'Max',
      clinicName: 'Happy Paws Veterinary',
    },
    {
      id: 'plan-d-002',
      totalBillCents: 95000,
      totalWithFeeCents: 100700,
      remainingCents: 67133,
      createdAt: '2025-09-15T00:00:00.000Z',
      updatedAt: '2026-01-30T00:00:00.000Z',
      ownerName: 'Mike Brown',
      ownerEmail: 'mike.b@example.com',
      ownerPhone: '+15557778888',
      petName: 'Rocky',
      clinicName: 'Sunset Animal Hospital',
    },
  ],
  pagination: {
    limit: 20,
    offset: 0,
    totalCount: 2,
  },
};

export const adminSoftCollectionStats = {
  totalCollections: 15,
  byStage: {
    day_1_reminder: 5,
    day_7_followup: 4,
    day_14_final: 2,
    completed: 3,
    cancelled: 1,
  },
  recoveryRate: 20.0,
};

// ─── Empty-State Variants ───────────────────────────────────────────────────

export const emptyOwnerDashboardSummary = {
  nextPayment: null,
  totalPaidCents: 0,
  totalRemainingCents: 0,
  activePlans: 0,
  totalPlans: 0,
};

export const emptyOwnerPlans: typeof ownerPlans = [];

export const emptyOwnerPaymentHistory = {
  payments: [],
  pagination: { page: 1, pageSize: 10, totalCount: 0, totalPages: 0 },
};

export const emptyClinicDashboardStats = {
  activePlans: 0,
  completedPlans: 0,
  defaultedPlans: 0,
  totalPlans: 0,
  totalRevenueCents: 0,
  totalPayoutCents: 0,
  pendingPayoutsCount: 0,
  pendingPayoutsCents: 0,
  recentEnrollments: [],
};

export const emptyClinicClients = {
  clients: [],
  pagination: { page: 1, pageSize: 20, totalCount: 0, totalPages: 0 },
};

export const emptyPayoutEarnings = {
  totalPayoutCents: 0,
  totalClinicShareCents: 0,
  pendingPayoutCents: 0,
  completedPayoutCount: 0,
};

export const emptyPayoutHistory = {
  payouts: [],
  total: 0,
};

export const emptyAdminPlatformStats = {
  totalEnrollments: 0,
  activePlans: 0,
  completedPlans: 0,
  defaultedPlans: 0,
  totalRevenueCents: 0,
  totalFeesCents: 0,
  defaultRate: 0,
};

export const emptyAdminRiskPoolHealth = {
  balanceCents: 0,
  outstandingGuaranteesCents: 0,
  coverageRatio: 0,
  activePlanCount: 0,
};

export const emptyAdminClinics = {
  clinics: [],
  pagination: { limit: 20, offset: 0, totalCount: 0 },
};

export const emptyAdminPayments = {
  payments: [],
  pagination: { limit: 20, offset: 0, totalCount: 0 },
};

// ─── Paginated Second-Page Data ─────────────────────────────────────────────

export const clinicClientsPage2 = {
  clients: [
    {
      planId: 'plan-c-005',
      ownerName: 'Emily Chen',
      ownerEmail: 'emily.c@example.com',
      ownerPhone: '+15556667777',
      petName: 'Coco',
      totalBillCents: 95000,
      totalWithFeeCents: 100700,
      planStatus: 'active',
      nextPaymentAt: '2026-03-15T00:00:00.000Z',
      createdAt: '2026-02-01T00:00:00.000Z',
      totalPaidCents: 25175,
    },
    {
      planId: 'plan-c-006',
      ownerName: 'David Park',
      ownerEmail: 'david.p@example.com',
      ownerPhone: '+15558889999',
      petName: 'Milo',
      totalBillCents: 75000,
      totalWithFeeCents: 79500,
      planStatus: 'completed',
      nextPaymentAt: null,
      createdAt: '2025-11-01T00:00:00.000Z',
      totalPaidCents: 79500,
    },
  ],
  pagination: { page: 2, pageSize: 20, totalCount: 6, totalPages: 2 },
};

export const ownerPaymentHistoryPage2 = {
  payments: [
    {
      id: 'pay-006',
      type: 'installment' as const,
      sequenceNum: 5,
      amountCents: 10600,
      status: 'pending' as const,
      scheduledAt: '2026-03-20T00:00:00.000Z',
      processedAt: null,
      failureReason: null,
      retryCount: null,
    },
  ],
  pagination: { page: 2, pageSize: 5, totalCount: 6, totalPages: 2 },
};

// ─── Filtered Result Sets ───────────────────────────────────────────────────

export const clinicClientsFilteredActive = {
  clients: clinicClients.clients.filter((c) => c.planStatus === 'active'),
  pagination: { page: 1, pageSize: 20, totalCount: 2, totalPages: 1 },
};

export const clinicClientsFilteredBySearch = {
  clients: clinicClients.clients.filter((c) => c.ownerName.toLowerCase().includes('jane')),
  pagination: { page: 1, pageSize: 20, totalCount: 1, totalPages: 1 },
};

export const clinicClientsFilteredEmpty = {
  clients: [],
  pagination: { page: 1, pageSize: 20, totalCount: 0, totalPages: 0 },
};

export const adminClinicsFilteredPending = {
  clinics: adminClinics.clinics.filter((c) => c.status === 'pending'),
  pagination: { limit: 20, offset: 0, totalCount: 1 },
};

export const adminClinicsFilteredBySearch = {
  clinics: adminClinics.clinics.filter((c) => c.name.toLowerCase().includes('happy')),
  pagination: { limit: 20, offset: 0, totalCount: 1 },
};

// ─── Incomplete Onboarding Variant ──────────────────────────────────────────

export const clinicOnboardingIncomplete = {
  clinicId: 'clinic-new-001',
  clinicName: 'New Vet Clinic',
  clinicStatus: 'pending' as const,
  profileComplete: false,
  stripe: {
    status: 'not_started' as const,
    chargesEnabled: false,
    payoutsEnabled: false,
    accountId: null,
  },
  mfaEnabled: false,
  mfaRequired: true,
  allComplete: false,
};
