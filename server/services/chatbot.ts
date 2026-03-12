import { google } from '@ai-sdk/google';
import { embed } from 'ai';
import { sql } from 'drizzle-orm';
import { serverEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { db } from '@/server/db';
import { knowledgeChunks } from '@/server/db/schema';

export type KnowledgeChunk = {
  id: string;
  source: string;
  title: string;
  content: string;
  metadata: unknown;
  similarity?: number;
};

/**
 * Generate a 768-dimension embedding using Gemini text-embedding-004.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: google.textEmbeddingModel('text-embedding-004'),
    value: text,
  });
  return embedding;
}

/**
 * Find relevant knowledge chunks via cosine similarity search using pgvector.
 */
export async function findRelevantChunks(query: string, limit = 5): Promise<KnowledgeChunk[]> {
  const env = serverEnv();
  if (!env.GEMINI_API_KEY) {
    return [];
  }

  try {
    const queryEmbedding = await generateEmbedding(query);
    const vectorStr = `[${queryEmbedding.join(',')}]`;

    const results = await db.execute(sql`
      SELECT
        ${knowledgeChunks.id},
        ${knowledgeChunks.source},
        ${knowledgeChunks.title},
        ${knowledgeChunks.content},
        ${knowledgeChunks.metadata},
        1 - (${knowledgeChunks.embedding} <=> ${vectorStr}::vector) as similarity
      FROM ${knowledgeChunks}
      ORDER BY ${knowledgeChunks.embedding} <=> ${vectorStr}::vector
      LIMIT ${limit}
    `);

    return Array.from(results).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      source: row.source as string,
      title: row.title as string,
      content: row.content as string,
      metadata: row.metadata,
      similarity: row.similarity as number,
    }));
  } catch (error) {
    // Fall back to empty chunks if pgvector query fails
    logger.error('Failed to find relevant chunks', { error: error instanceof Error ? error.message : 'Unknown error' });
    return [];
  }
}

/**
 * Build the system prompt with retrieved context and safety guardrails.
 */
export function buildSystemPrompt(chunks: KnowledgeChunk[]): string {
  const contextSection =
    chunks.length > 0
      ? `\n\n## Relevant Knowledge Base Context\n\nUse the following information to answer the user's question accurately:\n\n${chunks.map((c) => `### ${c.title}\n${c.content}`).join('\n\n')}`
      : '';

  return `You are FuzzyCat's friendly support assistant for veterinary payment plans.

## Guidelines
- Only answer questions about FuzzyCat, veterinary payment plans, and related topics.
- Never provide medical, veterinary, legal, or financial advice.
- Never disclose internal business details such as revenue share percentages, platform reserve, or internal fee breakdowns. If asked about how FuzzyCat makes money, say the platform is funded by the platform fee paid by pet owners.
- If you are unsure or the question is outside your knowledge, direct the user to the support page at fuzzycatapp.com/support or suggest they use the feedback button.
- Keep responses concise — 2-3 sentences for simple questions, up to a short paragraph for complex ones.
- Tone: friendly, clear, and professional — like talking to a vet clinic receptionist.
- Never make up information. Only use facts from the provided context.
- If the user asks about something not covered in your context, say you don't have that information and suggest contacting support.${contextSection}`;
}
