-- knowledge_chunks table for RAG chatbot
CREATE TABLE IF NOT EXISTS "knowledge_chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source" text NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "embedding" vector(768) NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS "knowledge_chunks_embedding_idx"
  ON "knowledge_chunks" USING hnsw ("embedding" vector_cosine_ops);

-- chat_sessions table for chatbot analytics
CREATE TABLE IF NOT EXISTS "chat_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "user_role" text,
  "messages" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "helpful" boolean,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
