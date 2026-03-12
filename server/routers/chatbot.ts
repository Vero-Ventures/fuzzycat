import { z } from 'zod';
import { db } from '@/server/db';
import { chatSessions } from '@/server/db/schema';
import { publicProcedure, router } from '@/server/trpc';

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(5000),
});

export const chatbotRouter = router({
  saveFeedback: publicProcedure
    .input(
      z.object({
        messageId: z.string().min(1).max(5000),
        helpful: z.boolean(),
        messages: z.array(chatMessageSchema).max(50).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const storedMessages = input.messages ?? [{ messageId: input.messageId }];
      await db.insert(chatSessions).values({
        messages: storedMessages,
        helpful: input.helpful,
      });
      return { success: true };
    }),
});
