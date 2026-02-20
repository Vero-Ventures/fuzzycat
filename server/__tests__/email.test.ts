import { beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockEmailsSend = mock(() =>
  Promise.resolve({
    data: { id: 'email_test_123' } as { id: string } | null,
    error: null as { message: string; name: string } | null,
  }),
);

mock.module('@/lib/resend', () => ({
  resend: () => ({
    emails: { send: mockEmailsSend },
  }),
}));

// Import after mocking to ensure mocks are in place
const {
  sendEnrollmentConfirmation,
  sendPaymentReminder,
  sendPaymentSuccess,
  sendPaymentFailed,
  sendPlanCompleted,
  sendClinicWelcome,
  sendClinicPayoutNotification,
} = await import('@/server/services/email');

// ── Helper ───────────────────────────────────────────────────────────

/** Extract the call arguments from the mock as a plain object. */
function lastCallArgs(): Record<string, unknown> {
  const calls = mockEmailsSend.mock.calls as unknown as Record<string, unknown>[][];
  return calls[calls.length - 1][0];
}

// ── Test data ────────────────────────────────────────────────────────

const testDate = new Date('2026-03-01T12:00:00Z');
const futureDate = new Date('2026-03-15T12:00:00Z');

const enrollmentProps = {
  ownerName: 'Jane Doe',
  petName: 'Whiskers',
  clinicName: 'Happy Paws Vet',
  totalBillCents: 120_000,
  feeCents: 7_200,
  totalWithFeeCents: 127_200,
  depositCents: 31_800,
  installmentCents: 15_900,
  numInstallments: 6,
  schedule: [
    { type: 'deposit' as const, sequenceNum: 0, amountCents: 31_800, scheduledAt: testDate },
    { type: 'installment' as const, sequenceNum: 1, amountCents: 15_900, scheduledAt: futureDate },
  ],
  enrollmentDate: testDate,
  dashboardUrl: 'https://fuzzycatapp.com/owner/payments',
};

const reminderProps = {
  ownerName: 'Jane Doe',
  petName: 'Whiskers',
  clinicName: 'Happy Paws Vet',
  amountCents: 15_900,
  scheduledDate: futureDate,
  installmentNumber: 2,
  totalInstallments: 6,
  remainingBalanceCents: 63_600,
  dashboardUrl: 'https://fuzzycatapp.com/owner/payments',
};

const successProps = {
  ownerName: 'Jane Doe',
  petName: 'Whiskers',
  clinicName: 'Happy Paws Vet',
  amountCents: 15_900,
  paymentDate: testDate,
  paymentType: 'installment' as const,
  installmentNumber: 2,
  totalInstallments: 6,
  remainingBalanceCents: 47_700,
  nextPaymentDate: futureDate,
  nextPaymentAmountCents: 15_900,
  dashboardUrl: 'https://fuzzycatapp.com/owner/payments',
};

const failedProps = {
  ownerName: 'Jane Doe',
  petName: 'Whiskers',
  clinicName: 'Happy Paws Vet',
  amountCents: 15_900,
  failedDate: testDate,
  installmentNumber: 2,
  totalInstallments: 6,
  failureReason: 'Insufficient funds',
  retryDate: futureDate,
  retriesRemaining: 2,
  dashboardUrl: 'https://fuzzycatapp.com/owner/payments',
};

const completedProps = {
  ownerName: 'Jane Doe',
  petName: 'Whiskers',
  clinicName: 'Happy Paws Vet',
  totalPaidCents: 127_200,
  completedDate: futureDate,
  enrollmentDate: testDate,
  dashboardUrl: 'https://fuzzycatapp.com/owner/payments',
};

const clinicWelcomeProps = {
  clinicName: 'Happy Paws Vet',
  contactName: 'Dr. Smith',
  dashboardUrl: 'https://fuzzycatapp.com/clinic/dashboard',
  connectUrl: 'https://fuzzycatapp.com/clinic/connect',
};

const clinicPayoutProps = {
  clinicName: 'Happy Paws Vet',
  contactName: 'Dr. Smith',
  transferAmountCents: 15_327,
  clinicShareCents: 477,
  paymentAmountCents: 15_900,
  planId: 'plan-123',
  ownerName: 'Jane Doe',
  petName: 'Whiskers',
  payoutDate: testDate,
  stripeTransferId: 'tr_abc123',
  dashboardUrl: 'https://fuzzycatapp.com/clinic/payouts',
};

// ── Helper to create error mock ──────────────────────────────────────

function mockResendError(message: string, name: string) {
  mockEmailsSend.mockImplementation(() =>
    Promise.resolve({
      data: null,
      error: { message, name },
    }),
  );
}

// ── Tests ────────────────────────────────────────────────────────────

describe('email service', () => {
  beforeEach(() => {
    mockEmailsSend.mockClear();
    mockEmailsSend.mockImplementation(() =>
      Promise.resolve({
        data: { id: 'email_test_123' },
        error: null,
      }),
    );
  });

  // ── sendEnrollmentConfirmation ───────────────────────────────────

  describe('sendEnrollmentConfirmation', () => {
    it('sends enrollment confirmation email via Resend', async () => {
      const result = await sendEnrollmentConfirmation('jane@example.com', enrollmentProps);

      expect(result.id).toBe('email_test_123');
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    });

    it('passes correct from address and recipient', async () => {
      await sendEnrollmentConfirmation('jane@example.com', enrollmentProps);

      const args = lastCallArgs();
      expect(args.from).toBe('FuzzyCat <noreply@fuzzycatapp.com>');
      expect(args.to).toBe('jane@example.com');
    });

    it('includes pet name in subject line', async () => {
      await sendEnrollmentConfirmation('jane@example.com', enrollmentProps);

      const args = lastCallArgs();
      expect(args.subject).toContain('Whiskers');
    });

    it('passes a React component for rendering', async () => {
      await sendEnrollmentConfirmation('jane@example.com', enrollmentProps);

      const args = lastCallArgs();
      expect(args.react).toBeDefined();
    });

    it('throws when Resend returns an error', async () => {
      mockResendError('Invalid API key', 'validation_error');

      await expect(sendEnrollmentConfirmation('jane@example.com', enrollmentProps)).rejects.toThrow(
        'Failed to send enrollment confirmation email: Invalid API key',
      );
    });
  });

  // ── sendPaymentReminder ──────────────────────────────────────────

  describe('sendPaymentReminder', () => {
    it('sends payment reminder email via Resend', async () => {
      const result = await sendPaymentReminder('jane@example.com', reminderProps);

      expect(result.id).toBe('email_test_123');
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    });

    it('includes pet name in subject line', async () => {
      await sendPaymentReminder('jane@example.com', reminderProps);

      const args = lastCallArgs();
      expect(args.subject).toContain('Whiskers');
    });

    it('throws when Resend returns an error', async () => {
      mockResendError('Rate limited', 'rate_limit_error');

      await expect(sendPaymentReminder('jane@example.com', reminderProps)).rejects.toThrow(
        'Failed to send payment reminder email: Rate limited',
      );
    });
  });

  // ── sendPaymentSuccess ───────────────────────────────────────────

  describe('sendPaymentSuccess', () => {
    it('sends payment success email via Resend', async () => {
      const result = await sendPaymentSuccess('jane@example.com', successProps);

      expect(result.id).toBe('email_test_123');
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    });

    it('includes pet name in subject line', async () => {
      await sendPaymentSuccess('jane@example.com', successProps);

      const args = lastCallArgs();
      expect(args.subject).toContain('Whiskers');
    });

    it('throws when Resend returns an error', async () => {
      mockResendError('Server error', 'internal_server_error');

      await expect(sendPaymentSuccess('jane@example.com', successProps)).rejects.toThrow(
        'Failed to send payment success email: Server error',
      );
    });
  });

  // ── sendPaymentFailed ────────────────────────────────────────────

  describe('sendPaymentFailed', () => {
    it('sends payment failed email via Resend', async () => {
      const result = await sendPaymentFailed('jane@example.com', failedProps);

      expect(result.id).toBe('email_test_123');
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    });

    it('includes pet name in subject line', async () => {
      await sendPaymentFailed('jane@example.com', failedProps);

      const args = lastCallArgs();
      expect(args.subject).toContain('Whiskers');
    });

    it('throws when Resend returns an error', async () => {
      mockResendError('Forbidden', 'forbidden');

      await expect(sendPaymentFailed('jane@example.com', failedProps)).rejects.toThrow(
        'Failed to send payment failed email: Forbidden',
      );
    });
  });

  // ── sendPlanCompleted ────────────────────────────────────────────

  describe('sendPlanCompleted', () => {
    it('sends plan completed email via Resend', async () => {
      const result = await sendPlanCompleted('jane@example.com', completedProps);

      expect(result.id).toBe('email_test_123');
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    });

    it('includes pet name in subject line', async () => {
      await sendPlanCompleted('jane@example.com', completedProps);

      const args = lastCallArgs();
      expect(args.subject).toContain('Whiskers');
    });

    it('throws when Resend returns an error', async () => {
      mockResendError('Not found', 'not_found');

      await expect(sendPlanCompleted('jane@example.com', completedProps)).rejects.toThrow(
        'Failed to send plan completed email: Not found',
      );
    });
  });

  // ── sendClinicWelcome ────────────────────────────────────────────

  describe('sendClinicWelcome', () => {
    it('sends clinic welcome email via Resend', async () => {
      const result = await sendClinicWelcome('clinic@example.com', clinicWelcomeProps);

      expect(result.id).toBe('email_test_123');
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    });

    it('includes clinic name in subject line', async () => {
      await sendClinicWelcome('clinic@example.com', clinicWelcomeProps);

      const args = lastCallArgs();
      expect(args.subject).toContain('Happy Paws Vet');
    });

    it('throws when Resend returns an error', async () => {
      mockResendError('Invalid recipient', 'validation_error');

      await expect(sendClinicWelcome('clinic@example.com', clinicWelcomeProps)).rejects.toThrow(
        'Failed to send clinic welcome email: Invalid recipient',
      );
    });
  });

  // ── sendClinicPayoutNotification ─────────────────────────────────

  describe('sendClinicPayoutNotification', () => {
    it('sends clinic payout notification email via Resend', async () => {
      const result = await sendClinicPayoutNotification('clinic@example.com', clinicPayoutProps);

      expect(result.id).toBe('email_test_123');
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    });

    it('includes owner and pet name in subject line', async () => {
      await sendClinicPayoutNotification('clinic@example.com', clinicPayoutProps);

      const args = lastCallArgs();
      expect(args.subject).toContain('Jane Doe');
      expect(args.subject).toContain('Whiskers');
    });

    it('throws when Resend returns an error', async () => {
      mockResendError('Service unavailable', 'internal_server_error');

      await expect(
        sendClinicPayoutNotification('clinic@example.com', clinicPayoutProps),
      ).rejects.toThrow('Failed to send clinic payout notification email: Service unavailable');
    });
  });

  // ── Cross-cutting tests ──────────────────────────────────────────

  describe('common behavior', () => {
    it('all send functions use the FuzzyCat from address', async () => {
      const sends = [
        sendEnrollmentConfirmation('test@example.com', enrollmentProps),
        sendPaymentReminder('test@example.com', reminderProps),
        sendPaymentSuccess('test@example.com', successProps),
        sendPaymentFailed('test@example.com', failedProps),
        sendPlanCompleted('test@example.com', completedProps),
        sendClinicWelcome('test@example.com', clinicWelcomeProps),
        sendClinicPayoutNotification('test@example.com', clinicPayoutProps),
      ];

      await Promise.all(sends);

      expect(mockEmailsSend).toHaveBeenCalledTimes(7);

      const allCalls = mockEmailsSend.mock.calls as unknown as Record<string, unknown>[][];
      for (const call of allCalls) {
        expect(call[0].from).toBe('FuzzyCat <noreply@fuzzycatapp.com>');
      }
    });

    it('all send functions return the email id', async () => {
      const results = await Promise.all([
        sendEnrollmentConfirmation('test@example.com', enrollmentProps),
        sendPaymentReminder('test@example.com', reminderProps),
        sendPaymentSuccess('test@example.com', successProps),
        sendPaymentFailed('test@example.com', failedProps),
        sendPlanCompleted('test@example.com', completedProps),
        sendClinicWelcome('test@example.com', clinicWelcomeProps),
        sendClinicPayoutNotification('test@example.com', clinicPayoutProps),
      ]);

      for (const result of results) {
        expect(result.id).toBe('email_test_123');
      }
    });
  });
});
