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
const { sendClinicWelcome } = await import('@/server/services/email');

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
});
