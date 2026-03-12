import { z } from 'zod';
import { db } from '@/server/db';
import { chatSessions } from '@/server/db/schema';
import { publicProcedure, router } from '@/server/trpc';

export const chatbotRouter = router({
  saveFeedback: publicProcedure
    .input(
      z.object({
        messageId: z.string().min(1),
        helpful: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      await db.insert(chatSessions).values({
        messages: [{ messageId: input.messageId }],
        helpful: input.helpful,
      });
      return { success: true };
    }),
});
