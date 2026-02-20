import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockMessagesCreate = mock(() =>
  Promise.resolve({
    sid: 'SM_test_message_123',
    status: 'queued',
  }),
);

mock.module('@/lib/twilio', () => ({
  twilio: () => ({
    messages: { create: mockMessagesCreate },
  }),
}));

mock.module('@/lib/env', () => ({
  serverEnv: () => ({
    TWILIO_ACCOUNT_SID: 'ACtest123',
    TWILIO_AUTH_TOKEN: 'test-auth-token',
    TWILIO_PHONE_NUMBER: '+15551234567',
  }),
}));

mock.module('@/lib/logger', () => ({
  logger: {
    info: mock(),
    warn: mock(),
    error: mock(),
  },
}));

const {
  sendSms,
  sendPaymentReminder,
  sendPaymentFailed,
  sendDefaultWarning,
  sendPaymentSuccess,
  recordOptOut,
  recordOptIn,
  isOptedOut,
  _resetSmsState,
} = await import('@/server/services/sms');

// ── Setup / teardown ─────────────────────────────────────────────────

beforeEach(() => {
  _resetSmsState();
  mockMessagesCreate.mockClear();
  mockMessagesCreate.mockImplementation(() =>
    Promise.resolve({
      sid: 'SM_test_message_123',
      status: 'queued',
    }),
  );
});

afterEach(() => {
  _resetSmsState();
});

// ── sendSms core tests ──────────────────────────────────────────────

describe('sendSms', () => {
  it('sends an SMS via Twilio and returns success', async () => {
    const result = await sendSms('+12125551234', 'Test message');

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('SM_test_message_123');
    expect(mockMessagesCreate).toHaveBeenCalledWith({
      to: '+12125551234',
      from: '+15551234567',
      body: expect.stringContaining('Test message'),
    });
  });

  it('appends opt-out notice on first message to a number', async () => {
    await sendSms('+12125551234', 'Hello');

    const callArgs = mockMessagesCreate.mock.calls[0] as unknown as [{ body: string }];
    expect(callArgs[0].body).toContain('Reply STOP to opt out');
  });

  it('does not append opt-out notice on subsequent messages', async () => {
    await sendSms('+12125551234', 'First message');
    mockMessagesCreate.mockClear();

    await sendSms('+12125551234', 'Second message');

    const callArgs = mockMessagesCreate.mock.calls[0] as unknown as [{ body: string }];
    expect(callArgs[0].body).toBe('Second message');
    expect(callArgs[0].body).not.toContain('Reply STOP');
  });

  it('rejects invalid US phone numbers', async () => {
    const result = await sendSms('not-a-phone', 'Test');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid US phone number');
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it('rejects non-US phone numbers', async () => {
    const result = await sendSms('+442071234567', 'Test');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid US phone number');
  });

  it('skips sending when phone has opted out', async () => {
    recordOptOut('+12125551234');

    const result = await sendSms('+12125551234', 'Test');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Phone number has opted out of SMS');
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it('returns error when Twilio API fails', async () => {
    mockMessagesCreate.mockRejectedValueOnce(new Error('Twilio API error'));

    const result = await sendSms('+12125551234', 'Test');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Twilio API error');
  });

  it('enforces daily rate limit per phone number', async () => {
    // Send MAX_SMS_PER_DAY (10) messages
    for (let i = 0; i < 10; i++) {
      const result = await sendSms('+12125551234', `Message ${i}`);
      expect(result.success).toBe(true);
    }

    // 11th message should be rate limited
    const result = await sendSms('+12125551234', 'One too many');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Daily SMS rate limit exceeded');
  });

  it('rate limits are per-phone (different phones have separate limits)', async () => {
    // Send 10 to first number
    for (let i = 0; i < 10; i++) {
      await sendSms('+12125551234', `Message ${i}`);
    }

    // Different number should still work
    const result = await sendSms('+13105551234', 'Different phone');
    expect(result.success).toBe(true);
  });
});

// ── Opt-out tests ───────────────────────────────────────────────────

describe('opt-out handling', () => {
  it('recordOptOut marks a phone as opted out', () => {
    recordOptOut('+12125551234');
    expect(isOptedOut('+12125551234')).toBe(true);
  });

  it('recordOptIn reverses an opt-out', () => {
    recordOptOut('+12125551234');
    expect(isOptedOut('+12125551234')).toBe(true);

    recordOptIn('+12125551234');
    expect(isOptedOut('+12125551234')).toBe(false);
  });

  it('isOptedOut returns false for numbers that have not opted out', () => {
    expect(isOptedOut('+19995551234')).toBe(false);
  });

  it('blocks SMS sending after opt-out', async () => {
    recordOptOut('+12125551234');

    const result = await sendPaymentReminder('+12125551234', {
      amountCents: 10000,
      date: new Date('2026-03-01'),
      planId: 'plan-123',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Phone number has opted out of SMS');
  });

  it('allows SMS sending after opt-in (reversal of opt-out)', async () => {
    recordOptOut('+12125551234');
    recordOptIn('+12125551234');

    const result = await sendPaymentReminder('+12125551234', {
      amountCents: 10000,
      date: new Date('2026-03-01'),
      planId: 'plan-123',
    });

    expect(result.success).toBe(true);
  });
});

// ── sendPaymentReminder tests ───────────────────────────────────────

describe('sendPaymentReminder', () => {
  it('sends formatted payment reminder', async () => {
    const result = await sendPaymentReminder('+12125551234', {
      amountCents: 12550,
      date: new Date('2026-03-15'),
      planId: 'plan-abc',
    });

    expect(result.success).toBe(true);
    const callArgs = mockMessagesCreate.mock.calls[0] as unknown as [{ body: string }];
    expect(callArgs[0].body).toContain('$125.50');
    expect(callArgs[0].body).toContain('Mar 15, 2026');
    expect(callArgs[0].body).toContain('FuzzyCat');
  });

  it('formats zero-cent amounts correctly', async () => {
    await sendPaymentReminder('+12125551234', {
      amountCents: 10000,
      date: new Date('2026-04-01'),
      planId: 'plan-def',
    });

    const callArgs = mockMessagesCreate.mock.calls[0] as unknown as [{ body: string }];
    expect(callArgs[0].body).toContain('$100.00');
  });
});

// ── sendPaymentFailed tests ─────────────────────────────────────────

describe('sendPaymentFailed', () => {
  it('sends formatted payment failure notification', async () => {
    const result = await sendPaymentFailed('+12125551234', {
      amountCents: 7500,
      retryDate: new Date('2026-03-20'),
      planId: 'plan-xyz',
    });

    expect(result.success).toBe(true);
    const callArgs = mockMessagesCreate.mock.calls[0] as unknown as [{ body: string }];
    expect(callArgs[0].body).toContain('$75.00');
    expect(callArgs[0].body).toContain('could not be processed');
    expect(callArgs[0].body).toContain('Mar 20, 2026');
  });
});

// ── sendDefaultWarning tests ────────────────────────────────────────

describe('sendDefaultWarning', () => {
  it('sends default warning notification', async () => {
    const result = await sendDefaultWarning('+12125551234', {
      planId: 'plan-warn',
    });

    expect(result.success).toBe(true);
    const callArgs = mockMessagesCreate.mock.calls[0] as unknown as [{ body: string }];
    expect(callArgs[0].body).toContain('Final notice');
    expect(callArgs[0].body).toContain('update your payment method');
  });
});

// ── sendPaymentSuccess tests ────────────────────────────────────────

describe('sendPaymentSuccess', () => {
  it('sends payment success with remaining balance', async () => {
    const result = await sendPaymentSuccess('+12125551234', {
      amountCents: 5000,
      remainingCents: 25000,
      planId: 'plan-success',
    });

    expect(result.success).toBe(true);
    const callArgs = mockMessagesCreate.mock.calls[0] as unknown as [{ body: string }];
    expect(callArgs[0].body).toContain('$50.00');
    expect(callArgs[0].body).toContain('$250.00 remaining');
  });

  it('sends completion message when remaining is zero', async () => {
    const result = await sendPaymentSuccess('+12125551234', {
      amountCents: 5000,
      remainingCents: 0,
      planId: 'plan-done',
    });

    expect(result.success).toBe(true);
    const callArgs = mockMessagesCreate.mock.calls[0] as unknown as [{ body: string }];
    expect(callArgs[0].body).toContain('$50.00');
    expect(callArgs[0].body).toContain('plan is now complete');
  });
});
