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
  sendClinicWelcome,
  sendEnrollmentInvite,
  sendSoftCollectionDay1,
  sendSoftCollectionDay7,
  sendSoftCollectionDay14,
} = await import('@/server/services/email');

// ── Helper ───────────────────────────────────────────────────────────

/** Extract the call arguments from the mock as a plain object. */
function lastCallArgs(): Record<string, unknown> {
  const calls = mockEmailsSend.mock.calls as unknown as Record<string, unknown>[][];
  return calls[calls.length - 1][0];
}

// ── Test data ────────────────────────────────────────────────────────

const clinicWelcomeProps = {
  clinicName: 'Happy Paws Vet',
  contactName: 'Dr. Smith',
  dashboardUrl: 'https://fuzzycatapp.com/clinic/dashboard',
  connectUrl: 'https://fuzzycatapp.com/clinic/connect',
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

    it('passes correct from address and recipient', async () => {
      await sendClinicWelcome('clinic@example.com', clinicWelcomeProps);

      const args = lastCallArgs();
      expect(args.from).toBe('FuzzyCat <noreply@fuzzycatapp.com>');
      expect(args.to).toBe('clinic@example.com');
    });

    it('passes a React component for rendering', async () => {
      await sendClinicWelcome('clinic@example.com', clinicWelcomeProps);

      const args = lastCallArgs();
      expect(args.react).toBeDefined();
    });

    it('throws when Resend returns an error', async () => {
      mockResendError('Invalid recipient', 'validation_error');

      await expect(sendClinicWelcome('clinic@example.com', clinicWelcomeProps)).rejects.toThrow(
        'Failed to send clinic welcome email: Invalid recipient',
      );
    });

    it('throws when Resend returns no data', async () => {
      mockEmailsSend.mockImplementation(() =>
        Promise.resolve({
          data: null,
          error: null,
        }),
      );

      await expect(sendClinicWelcome('clinic@example.com', clinicWelcomeProps)).rejects.toThrow(
        'Failed to send clinic welcome email: no data returned',
      );
    });
  });

  // ── sendEnrollmentInvite ─────────────────────────────────────────

  describe('sendEnrollmentInvite', () => {
    const enrollmentInviteProps = {
      petName: 'Buddy',
      ownerName: 'Jane Doe',
      clinicName: 'Happy Paws Vet',
      totalBillCents: 100000,
      feeCents: 6000,
      depositCents: 26500,
      installmentCents: 13250,
      numInstallments: 6,
      setupUrl: 'https://fuzzycatapp.com/enroll/abc123',
    };

    it('sends enrollment invite email via Resend', async () => {
      const result = await sendEnrollmentInvite('owner@example.com', enrollmentInviteProps);

      expect(result.id).toBe('email_test_123');
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    });

    it('includes pet name in subject line', async () => {
      await sendEnrollmentInvite('owner@example.com', enrollmentInviteProps);

      const args = lastCallArgs();
      expect(args.subject).toContain('Buddy');
    });

    it('passes correct from address and recipient', async () => {
      await sendEnrollmentInvite('owner@example.com', enrollmentInviteProps);

      const args = lastCallArgs();
      expect(args.from).toBe('FuzzyCat <noreply@fuzzycatapp.com>');
      expect(args.to).toBe('owner@example.com');
    });

    it('throws when Resend returns an error', async () => {
      mockResendError('Rate limit exceeded', 'rate_limit_error');

      await expect(
        sendEnrollmentInvite('owner@example.com', enrollmentInviteProps),
      ).rejects.toThrow('Failed to send enrollment invite email: Rate limit exceeded');
    });

    it('throws when Resend returns no data', async () => {
      mockEmailsSend.mockImplementation(() => Promise.resolve({ data: null, error: null }));

      await expect(
        sendEnrollmentInvite('owner@example.com', enrollmentInviteProps),
      ).rejects.toThrow('Failed to send enrollment invite email: no data returned');
    });
  });

  // ── sendSoftCollectionDay1 ───────────────────────────────────────

  describe('sendSoftCollectionDay1', () => {
    const softCollectionDay1Props = {
      petName: 'Buddy',
      ownerName: 'Jane Doe',
      clinicName: 'Happy Paws Vet',
      remainingCents: 12500,
      dashboardUrl: 'https://fuzzycatapp.com/client/dashboard',
      updatePaymentUrl: 'https://fuzzycatapp.com/client/payments',
    };

    it('sends day 1 soft collection email via Resend', async () => {
      const result = await sendSoftCollectionDay1('owner@example.com', softCollectionDay1Props);

      expect(result.id).toBe('email_test_123');
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    });

    it('includes pet name in subject line', async () => {
      await sendSoftCollectionDay1('owner@example.com', softCollectionDay1Props);

      const args = lastCallArgs();
      expect(args.subject).toContain('Buddy');
      expect(args.subject).toContain('needs attention');
    });

    it('throws when Resend returns an error', async () => {
      mockResendError('Server error', 'server_error');

      await expect(
        sendSoftCollectionDay1('owner@example.com', softCollectionDay1Props),
      ).rejects.toThrow('Failed to send soft collection day 1 email: Server error');
    });

    it('throws when Resend returns no data', async () => {
      mockEmailsSend.mockImplementation(() => Promise.resolve({ data: null, error: null }));

      await expect(
        sendSoftCollectionDay1('owner@example.com', softCollectionDay1Props),
      ).rejects.toThrow('Failed to send soft collection day 1 email: no data returned');
    });
  });

  // ── sendSoftCollectionDay7 ───────────────────────────────────────

  describe('sendSoftCollectionDay7', () => {
    const softCollectionDay7Props = {
      petName: 'Buddy',
      ownerName: 'Jane Doe',
      clinicName: 'Happy Paws Vet',
      remainingCents: 12500,
      dashboardUrl: 'https://fuzzycatapp.com/client/dashboard',
      updatePaymentUrl: 'https://fuzzycatapp.com/client/payments',
    };

    it('sends day 7 soft collection email via Resend', async () => {
      const result = await sendSoftCollectionDay7('owner@example.com', softCollectionDay7Props);

      expect(result.id).toBe('email_test_123');
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    });

    it('includes pet name and action required in subject', async () => {
      await sendSoftCollectionDay7('owner@example.com', softCollectionDay7Props);

      const args = lastCallArgs();
      expect(args.subject).toContain('Buddy');
      expect(args.subject).toContain('Action required');
    });

    it('throws when Resend returns an error', async () => {
      mockResendError('Invalid API key', 'auth_error');

      await expect(
        sendSoftCollectionDay7('owner@example.com', softCollectionDay7Props),
      ).rejects.toThrow('Failed to send soft collection day 7 email: Invalid API key');
    });

    it('throws when Resend returns no data', async () => {
      mockEmailsSend.mockImplementation(() => Promise.resolve({ data: null, error: null }));

      await expect(
        sendSoftCollectionDay7('owner@example.com', softCollectionDay7Props),
      ).rejects.toThrow('Failed to send soft collection day 7 email: no data returned');
    });
  });

  // ── sendSoftCollectionDay14 ──────────────────────────────────────

  describe('sendSoftCollectionDay14', () => {
    const softCollectionDay14Props = {
      petName: 'Buddy',
      ownerName: 'Jane Doe',
      clinicName: 'Happy Paws Vet',
      remainingCents: 12500,
      dashboardUrl: 'https://fuzzycatapp.com/client/dashboard',
      updatePaymentUrl: 'https://fuzzycatapp.com/client/payments',
    };

    it('sends day 14 soft collection email via Resend', async () => {
      const result = await sendSoftCollectionDay14('owner@example.com', softCollectionDay14Props);

      expect(result.id).toBe('email_test_123');
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    });

    it('includes pet name and final notice in subject', async () => {
      await sendSoftCollectionDay14('owner@example.com', softCollectionDay14Props);

      const args = lastCallArgs();
      expect(args.subject).toContain('Buddy');
      expect(args.subject).toContain('Final notice');
    });

    it('throws when Resend returns an error', async () => {
      mockResendError('Recipient not found', 'validation_error');

      await expect(
        sendSoftCollectionDay14('owner@example.com', softCollectionDay14Props),
      ).rejects.toThrow('Failed to send soft collection day 14 email: Recipient not found');
    });

    it('throws when Resend returns no data', async () => {
      mockEmailsSend.mockImplementation(() => Promise.resolve({ data: null, error: null }));

      await expect(
        sendSoftCollectionDay14('owner@example.com', softCollectionDay14Props),
      ).rejects.toThrow('Failed to send soft collection day 14 email: no data returned');
    });
  });
});
