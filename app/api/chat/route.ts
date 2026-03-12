import { google } from '@ai-sdk/google';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { convertToModelMessages, streamText, type UIMessage } from 'ai';
import { serverEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { buildSystemPrompt, findRelevantChunks } from '@/server/services/chatbot';

// Upstash Redis rate limiter (per IP, 10 req/60s sliding window)
let chatRatelimit: Ratelimit | null = null;

function getChatRatelimit(): Ratelimit | null {
  if (chatRatelimit) return chatRatelimit;

  const env = serverEnv();
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  chatRatelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(10, '60 s'),
    analytics: true,
    prefix: 'fuzzycat:chat-ratelimit',
  });

  return chatRatelimit;
}

async function isRateLimited(ip: string): Promise<boolean> {
  const limiter = getChatRatelimit();
  if (!limiter) return false; // fail-open when Redis unavailable

  try {
    const result = await limiter.limit(ip);
    return !result.success;
  } catch (error) {
    logger.error('Chat rate limit check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Fail open — don't block users if Redis is down
    return false;
  }
}

/** Extract text content from a UIMessage parts array. */
function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join(' ');
}

export async function POST(req: Request) {
  const env = serverEnv();

  if (!env.GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({
        error: 'Chatbot is not configured. Please try again later.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Rate limiting
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() ?? 'unknown';
  if (await isRateLimited(ip)) {
    return new Response(
      JSON.stringify({
        error: 'Too many requests. Please try again in a moment.',
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    const { messages } = (await req.json()) as { messages: UIMessage[] };

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages array is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get the last user message for RAG query
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    const query = lastUserMessage ? getMessageText(lastUserMessage) : '';
    const chunks = await findRelevantChunks(query, 5);
    const systemPrompt = buildSystemPrompt(chunks);

    const result = streamText({
      model: google('gemini-2.5-flash-lite'),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      maxOutputTokens: 500,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    logger.error('Chat API error', { error: error instanceof Error ? error.message : 'Unknown error' });
    return new Response(
      JSON.stringify({
        error: 'An error occurred processing your request. Please try again.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
