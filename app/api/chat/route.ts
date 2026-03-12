import { google } from '@ai-sdk/google';
import { convertToModelMessages, streamText, type UIMessage } from 'ai';
import { serverEnv } from '@/lib/env';
import { buildSystemPrompt, findRelevantChunks } from '@/server/services/chatbot';

// Simple in-memory rate limiter (per IP, 10 req/min)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
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
  if (isRateLimited(ip)) {
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
  } catch {
    return new Response(
      JSON.stringify({
        error: 'An error occurred processing your request. Please try again.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
