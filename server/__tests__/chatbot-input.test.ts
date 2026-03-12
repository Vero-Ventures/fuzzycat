import { describe, expect, it } from 'bun:test';
import { z } from 'zod';

/**
 * Test the chatbot saveFeedback input schema validation.
 * We replicate the schema here to test in isolation without needing
 * the full tRPC router setup and its module dependencies.
 */

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(5000),
});

const saveFeedbackInputSchema = z.object({
  messageId: z.string().min(1).max(5000),
  helpful: z.boolean(),
  messages: z.array(chatMessageSchema).max(50).optional(),
});

describe('chatbot saveFeedback input validation', () => {
  it('accepts valid input with messages', () => {
    const result = saveFeedbackInputSchema.safeParse({
      messageId: 'msg-1',
      helpful: true,
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid input without messages', () => {
    const result = saveFeedbackInputSchema.safeParse({
      messageId: 'msg-1',
      helpful: false,
    });
    expect(result.success).toBe(true);
  });

  it('rejects messages array exceeding 50 items', () => {
    const oversizedMessages = Array.from({ length: 51 }, (_, i) => ({
      role: 'user' as const,
      content: `Message ${i}`,
    }));

    const result = saveFeedbackInputSchema.safeParse({
      messageId: 'msg-1',
      helpful: true,
      messages: oversizedMessages,
    });
    expect(result.success).toBe(false);
  });

  it('accepts exactly 50 messages', () => {
    const maxMessages = Array.from({ length: 50 }, (_, i) => ({
      role: 'user' as const,
      content: `Message ${i}`,
    }));

    const result = saveFeedbackInputSchema.safeParse({
      messageId: 'msg-1',
      helpful: true,
      messages: maxMessages,
    });
    expect(result.success).toBe(true);
  });

  it('rejects message content exceeding 5000 characters', () => {
    const longContent = 'x'.repeat(5001);

    const result = saveFeedbackInputSchema.safeParse({
      messageId: 'msg-1',
      helpful: true,
      messages: [{ role: 'user', content: longContent }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts message content at exactly 5000 characters', () => {
    const maxContent = 'x'.repeat(5000);

    const result = saveFeedbackInputSchema.safeParse({
      messageId: 'msg-1',
      helpful: true,
      messages: [{ role: 'user', content: maxContent }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects messageId exceeding 5000 characters', () => {
    const longId = 'x'.repeat(5001);

    const result = saveFeedbackInputSchema.safeParse({
      messageId: longId,
      helpful: true,
    });
    expect(result.success).toBe(false);
  });
});
