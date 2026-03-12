/**
 * Seed knowledge base for the AI chatbot RAG pipeline.
 * Run: bun run scripts/seed-knowledge-base.ts
 */
import { sql } from 'drizzle-orm';
import { db } from '@/server/db';
import { knowledgeChunks } from '@/server/db/schema';
import { generateEmbedding } from '@/server/services/chatbot';

type ChunkInput = {
  source: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
};

const FAQ_CHUNKS: ChunkInput[] = [
  // ── Client FAQ ─────────────────────────────────────────
  {
    source: 'faq',
    title: 'How do payment plans work?',
    content:
      'Your veterinary clinic enrolls you in a FuzzyCat payment plan. You pay a 25% deposit upfront, and the remaining 75% is divided into 6 equal biweekly payments over 12 weeks. A flat 6% platform fee is included in your total — there is no interest and no credit check required.',
    metadata: { category: 'payments', audience: 'client' },
  },
  {
    source: 'faq',
    title: 'How does the deposit work?',
    content:
      'The deposit is 25% of your total amount (bill + 6% fee). It is charged to your debit card at the time of enrollment. Once the deposit is processed, your payment plan becomes active and your clinic is notified.',
    metadata: { category: 'payments', audience: 'client' },
  },
  {
    source: 'faq',
    title: 'What payment methods are accepted?',
    content:
      'Deposits are charged to your debit card. Installment payments are collected via ACH direct debit from your bank account or charged to your debit card, depending on your preference. Credit cards are not accepted. You can manage your payment method from the Settings page in your owner portal.',
    metadata: { category: 'payments', audience: 'client' },
  },
  {
    source: 'faq',
    title: 'When are my payments due?',
    content:
      'Payments are collected every two weeks starting after your deposit. Your full payment schedule with exact dates is visible in your owner portal under each plan. You will also receive email reminders before each payment.',
    metadata: { category: 'payments', audience: 'client' },
  },
  {
    source: 'faq',
    title: "What happens if a payment doesn't go through?",
    content:
      "If a payment doesn't go through, we'll automatically retry up to 3 times, with retries aligned to common paydays (the next Friday, 1st, or 15th that is at least 2 days out). You'll receive friendly reminders via email at day 1, 7, and 14. There are no late fees. If all 3 retries are unsuccessful, your plan will be paused and your clinic will be notified so you can work together on next steps.",
    metadata: { category: 'payments', audience: 'client' },
  },
  {
    source: 'faq',
    title: 'Can I cancel my payment plan?',
    content:
      'Payment plans cannot be cancelled once the deposit has been processed, as the funds are forwarded to the veterinary clinic. If you are experiencing financial difficulty, please contact your veterinary clinic directly to discuss possible options.',
    metadata: { category: 'policies', audience: 'client' },
  },
  {
    source: 'faq',
    title: 'Can I change my payment method?',
    content:
      'Yes. You can update your debit card or bank account at any time from the Settings page in your owner portal. Your new payment method will be used for all future installments.',
    metadata: { category: 'payments', audience: 'client' },
  },
  {
    source: 'faq',
    title: 'Is there a minimum or maximum bill amount?',
    content:
      'FuzzyCat payment plans are available for veterinary bills between $500 and $25,000. Bills outside this range are not eligible for enrollment.',
    metadata: { category: 'policies', audience: 'client' },
  },
  {
    source: 'faq',
    title: 'How do I get receipts for my payments?',
    content:
      'You receive an email confirmation after each successful payment. You can also view your complete payment history from your owner portal at any time.',
    metadata: { category: 'payments', audience: 'client' },
  },
  {
    source: 'faq',
    title: 'Can I have more than one payment plan?',
    content:
      'Yes. You can have multiple active payment plans at the same time if your clinic enrolls you for additional treatments. Each plan has its own payment schedule and is tracked independently.',
    metadata: { category: 'policies', audience: 'client' },
  },

  // ── Clinic FAQ ─────────────────────────────────────────
  {
    source: 'faq',
    title: 'How does my clinic get started with FuzzyCat?',
    content:
      'Register at fuzzycatapp.com/signup and complete Stripe Connect onboarding to receive payouts. There are no setup fees, monthly fees, or contracts. You can start enrolling clients immediately.',
    metadata: { category: 'onboarding', audience: 'clinic' },
  },
  {
    source: 'faq',
    title: 'What does FuzzyCat cost for clinics?',
    content:
      'Nothing. FuzzyCat is free for veterinary clinics. The 6% platform fee is paid entirely by the client.',
    metadata: { category: 'pricing', audience: 'clinic' },
  },
  {
    source: 'faq',
    title: 'When and how are clinics paid?',
    content:
      'After each successful installment payment from a client, the corresponding amount is transferred to your Stripe Connect account. Payouts are automatic and you can track every transfer in the Payouts section of your clinic portal.',
    metadata: { category: 'payouts', audience: 'clinic' },
  },
  {
    source: 'faq',
    title: 'How do I enroll a client?',
    content:
      'From your clinic portal, click "Initiate Enrollment" and fill in the client and treatment details. You can search for existing clients to auto-fill their information. The client will then receive instructions to complete their deposit and activate the plan.',
    metadata: { category: 'enrollment', audience: 'clinic' },
  },
  {
    source: 'faq',
    title: 'What happens if a client misses payments?',
    content:
      "FuzzyCat uses an automated soft collection process with escalating reminders. If all payment retries are unsuccessful, the plan is paused and the clinic is notified with the owner's contact information for direct follow-up. FuzzyCat does not guarantee payment — clinics retain responsibility for collecting outstanding balances.",
    metadata: { category: 'collections', audience: 'clinic' },
  },
  {
    source: 'faq',
    title: 'Can I integrate FuzzyCat with my practice management software?',
    content:
      'Yes. FuzzyCat provides a REST API that your practice management software can integrate with. You can generate API keys from the Settings page in your clinic portal. Full API documentation is available at fuzzycatapp.com/api-docs.',
    metadata: { category: 'integrations', audience: 'clinic' },
  },
  {
    source: 'faq',
    title: 'What reporting is available for clinics?',
    content:
      'Your clinic portal includes a Reports section with monthly revenue breakdowns, enrollment trends, and the ability to export data as CSV for your accounting software. The Payouts section shows a complete record of every transfer to your bank account.',
    metadata: { category: 'reporting', audience: 'clinic' },
  },

  // ── General FAQ ────────────────────────────────────────
  {
    source: 'faq',
    title: 'What is FuzzyCat?',
    content:
      'FuzzyCat is a payment plan platform for veterinary clinics. Pet owners split their vet bill into a 25% deposit and 6 biweekly installments over 12 weeks. There is no interest, no credit check, and no loan.',
    metadata: { category: 'general', audience: 'all' },
  },
  {
    source: 'faq',
    title: 'Is FuzzyCat a loan?',
    content:
      'No. FuzzyCat is a payment facilitation platform, not a lender. There are no credit checks, no interest charges, and no loan origination. The 6% fee is a flat platform fee, not interest.',
    metadata: { category: 'general', audience: 'all' },
  },
  {
    source: 'faq',
    title: 'Is my financial information secure?',
    content:
      'Yes. FuzzyCat never stores card numbers, bank account numbers, or routing numbers. All payment processing is handled by Stripe, which is PCI DSS Level 1 certified. Bank account connections are secured through Stripe Financial Connections. Your data is encrypted in transit and at rest.',
    metadata: { category: 'security', audience: 'all' },
  },
  {
    source: 'faq',
    title: 'Where is FuzzyCat available?',
    content:
      'FuzzyCat is currently available to veterinary clinics and clients in the United States, with the exception of New York where we are awaiting regulatory finalization. We plan to expand availability as regulations are confirmed.',
    metadata: { category: 'availability', audience: 'all' },
  },
  {
    source: 'faq',
    title: 'Is FuzzyCat accessible?',
    content:
      'Yes. FuzzyCat is built with accessibility in mind, including proper semantic HTML, ARIA labels, keyboard navigation, and screen reader support. The platform also supports light and dark mode based on your system preferences or manual toggle.',
    metadata: { category: 'accessibility', audience: 'all' },
  },

  // ── Business rules ─────────────────────────────────────
  {
    source: 'business_rules',
    title: 'FuzzyCat fee structure',
    content:
      'FuzzyCat charges a flat 6% platform fee to pet owners, added on top of the veterinary bill. There is no interest and no additional charges. The fee is transparent and shown upfront before enrollment. For example, a $1,000 vet bill would have a $60 fee, making the total $1,060.',
    metadata: { category: 'pricing', audience: 'all' },
  },
  {
    source: 'business_rules',
    title: 'Payment plan structure',
    content:
      'Every FuzzyCat payment plan consists of a 25% deposit charged immediately via debit card, followed by 6 equal biweekly installments covering the remaining 75%. The plan runs for 12 weeks total. Installments are collected via ACH direct debit or debit card.',
    metadata: { category: 'payments', audience: 'all' },
  },
  {
    source: 'business_rules',
    title: 'Eligible bill amounts',
    content:
      'FuzzyCat payment plans are available for veterinary bills between $500 and $25,000. Bills below $500 or above $25,000 are not eligible for enrollment through the platform.',
    metadata: { category: 'policies', audience: 'all' },
  },
  {
    source: 'business_rules',
    title: 'No credit check policy',
    content:
      'FuzzyCat does not perform credit checks or credit inquiries of any kind. There is no interest charged. FuzzyCat is not a lender and does not originate loans. The service is a payment facilitation platform.',
    metadata: { category: 'policies', audience: 'all' },
  },
  {
    source: 'business_rules',
    title: 'US availability and state restrictions',
    content:
      'FuzzyCat is available in all US states except New York. New York availability is pending finalization of DFS BNPL Act regulations. There is no timeline for when New York will be available.',
    metadata: { category: 'availability', audience: 'all' },
  },
  {
    source: 'how_it_works',
    title: 'How to get started as a pet owner',
    content:
      'To use FuzzyCat as a pet owner: 1) Your veterinary clinic enrolls you in a payment plan after your visit. 2) You receive an email or text with instructions to complete your deposit. 3) You connect your debit card or bank account via Stripe. 4) Your 25% deposit is charged immediately. 5) The remaining balance is split into 6 biweekly payments automatically.',
    metadata: { category: 'onboarding', audience: 'client' },
  },
  {
    source: 'how_it_works',
    title: 'How to get started as a veterinary clinic',
    content:
      'To use FuzzyCat as a clinic: 1) Register at fuzzycatapp.com/signup/clinic. 2) Complete Stripe Connect onboarding. 3) Start enrolling clients from your clinic portal. 4) Receive automatic payouts after each successful client payment. There are no setup fees, monthly fees, or long-term contracts.',
    metadata: { category: 'onboarding', audience: 'clinic' },
  },
];

async function seed() {
  console.log(`Seeding ${FAQ_CHUNKS.length} knowledge chunks...`);

  for (const chunk of FAQ_CHUNKS) {
    console.log(`  Embedding: ${chunk.title}`);
    const embedding = await generateEmbedding(`${chunk.title}\n${chunk.content}`);

    await db
      .insert(knowledgeChunks)
      .values({
        source: chunk.source,
        title: chunk.title,
        content: chunk.content,
        embedding,
        metadata: chunk.metadata,
      })
      .onConflictDoNothing();

    // Small delay to respect Gemini free tier rate limits
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Create HNSW index if it doesn't exist
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
    ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)
  `);

  console.log('Knowledge base seeded successfully.');
}

seed().catch((err) => {
  console.error('Failed to seed knowledge base:', err);
  process.exit(1);
});
