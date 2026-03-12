-- Add 'client' to the actor_type enum
-- The owners→clients rename (0001) updated tables/columns/indexes but missed
-- the actor_type PostgreSQL enum. The Drizzle schema already declares 'client'
-- as a valid value, but the production enum only has:
--   system, admin, owner, clinic
-- This causes INSERT failures when audit logging with actor_type='client'.

ALTER TYPE "actor_type" ADD VALUE IF NOT EXISTS 'client';
