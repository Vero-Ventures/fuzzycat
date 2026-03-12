import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { _resetEnvCache } from '@/lib/env';

// Mock the AI SDK
mock.module('ai', () => ({
  embed: async () => ({
    embedding: Array.from({ length: 768 }, (_, i) => i * 0.001),
  }),
}));

mock.module('@ai-sdk/google', () => ({
  google: Object.assign((model: string) => ({ modelId: model }), {
    textEmbeddingModel: (model: string) => ({ modelId: model }),
  }),
}));

// Mock the database — return an array-like (as drizzle postgres-js does)
const mockResults = [
  {
    id: 'chunk-1',
    source: 'faq',
    title: 'How do payment plans work?',
    content: 'You pay a 25% deposit and 6 biweekly installments.',
    metadata: { category: 'payments' },
    similarity: 0.92,
  },
  {
    id: 'chunk-2',
    source: 'business_rules',
    title: 'Fee structure',
    content: 'FuzzyCat charges a flat 6% platform fee.',
    metadata: { category: 'pricing' },
    similarity: 0.85,
  },
];
const mockExecute = mock(() => Promise.resolve(mockResults));

mock.module('@/server/db', () => ({
  db: {
    execute: mockExecute,
  },
}));

// Mock schema to prevent cross-contamination with other test files that mock it.
// Must include ALL exports from the real schema to avoid breaking other tests.
mock.module('@/server/db/schema', () => ({
  clinics: {},
  clients: {},
  paymentMethods: {},
  pets: {},
  plans: {},
  payments: {},
  payouts: {},
  riskPool: {},
  softCollections: {},
  apiKeys: {},
  auditLog: {},
  idempotencyKeys: {},
  webhookEndpoints: {},
  webhookDeliveries: {},
  clinicRequests: {},
  clinicReferrals: {},
  clientReferrals: {},
  knowledgeChunks: {
    id: 'id',
    source: 'source',
    title: 'title',
    content: 'content',
    metadata: 'metadata',
    embedding: 'embedding',
  },
  chatSessions: {
    id: 'id',
    messages: 'messages',
    helpful: 'helpful',
  },
  clinicStatusEnum: {},
  paymentMethodEnum: {},
  planStatusEnum: {},
  paymentTypeEnum: {},
  paymentStatusEnum: {},
  payoutStatusEnum: {},
  riskPoolTypeEnum: {},
  actorTypeEnum: {},
  softCollectionStageEnum: {},
  webhookDeliveryStatusEnum: {},
  referralStatusEnum: {},
  clinicsRelations: {},
  clientsRelations: {},
  paymentMethodsRelations: {},
  petsRelations: {},
  plansRelations: {},
  paymentsRelations: {},
  payoutsRelations: {},
  riskPoolRelations: {},
  softCollectionsRelations: {},
  apiKeysRelations: {},
  webhookEndpointsRelations: {},
  webhookDeliveriesRelations: {},
  clinicReferralsRelations: {},
  clientReferralsRelations: {},
}));

// Set required env vars for serverEnv() validation
const REQUIRED_ENV = {
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  STRIPE_SECRET_KEY: 'sk_test_1234',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_1234',
  RESEND_API_KEY: 're_test_1234',
  TWILIO_ACCOUNT_SID: 'ACtest1234',
  TWILIO_AUTH_TOKEN: 'test-auth-token',
  TWILIO_PHONE_NUMBER: '+15551234567',
};

describe('chatbot service', () => {
  beforeEach(() => {
    for (const [key, value] of Object.entries(REQUIRED_ENV)) {
      process.env[key] = value;
    }
    process.env.GEMINI_API_KEY = 'test-api-key';
    _resetEnvCache();
  });

  afterEach(() => {
    for (const key of Object.keys(REQUIRED_ENV)) {
      delete process.env[key];
    }
    // biome-ignore lint/performance/noDelete: must truly unset env var, not set to "undefined" string
    delete process.env.GEMINI_API_KEY;
    _resetEnvCache();
  });

  describe('buildSystemPrompt', () => {
    it('includes guardrails in the system prompt', async () => {
      const { buildSystemPrompt } = await import('@/server/services/chatbot');

      const prompt = buildSystemPrompt([]);

      expect(prompt).toContain("FuzzyCat's friendly support assistant");
      expect(prompt).toContain('Never provide medical');
      expect(prompt).toContain('Never disclose internal business details');
      expect(prompt).toContain('revenue share');
      expect(prompt).toContain('support page');
      expect(prompt).toContain('friendly, clear, and professional');
    });

    it('includes knowledge chunks in the context', async () => {
      const { buildSystemPrompt } = await import('@/server/services/chatbot');

      const chunks = [
        {
          id: '1',
          source: 'faq',
          title: 'Test Question',
          content: 'Test answer content.',
          metadata: {},
        },
      ];

      const prompt = buildSystemPrompt(chunks);

      expect(prompt).toContain('Relevant Knowledge Base Context');
      expect(prompt).toContain('Test Question');
      expect(prompt).toContain('Test answer content.');
    });

    it('omits context section when no chunks provided', async () => {
      const { buildSystemPrompt } = await import('@/server/services/chatbot');

      const prompt = buildSystemPrompt([]);

      expect(prompt).not.toContain('Relevant Knowledge Base Context');
    });
  });

  describe('generateEmbedding', () => {
    it('returns a 768-dimension embedding array', async () => {
      const { generateEmbedding } = await import('@/server/services/chatbot');

      const embedding = await generateEmbedding('test query');

      expect(embedding).toBeArray();
      expect(embedding).toHaveLength(768);
      expect(typeof embedding[0]).toBe('number');
    });
  });

  describe('findRelevantChunks', () => {
    it('returns empty array when GEMINI_API_KEY is not set', async () => {
      // biome-ignore lint/performance/noDelete: must truly unset env var, not set to "undefined" string
      delete process.env.GEMINI_API_KEY;
      _resetEnvCache();

      const { findRelevantChunks } = await import('@/server/services/chatbot');

      const chunks = await findRelevantChunks('test query');

      expect(chunks).toEqual([]);
    });

    it('returns chunks with correct format when API key is set', async () => {
      const { findRelevantChunks } = await import('@/server/services/chatbot');

      const chunks = await findRelevantChunks('payment plans', 2);

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toHaveProperty('id');
      expect(chunks[0]).toHaveProperty('source');
      expect(chunks[0]).toHaveProperty('title');
      expect(chunks[0]).toHaveProperty('content');
      expect(chunks[0]).toHaveProperty('similarity');
    });

    it('calls db.execute with the query', async () => {
      const { findRelevantChunks } = await import('@/server/services/chatbot');

      await findRelevantChunks('test query', 3);

      expect(mockExecute).toHaveBeenCalled();
    });
  });
});
