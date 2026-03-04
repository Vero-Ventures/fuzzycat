-- Rename owners → clients throughout the schema
-- This migration uses ALTER TABLE/COLUMN/INDEX RENAME (non-destructive, no data loss)

BEGIN;

-- Table renames
ALTER TABLE "owners" RENAME TO "clients";
ALTER TABLE "owner_referrals" RENAME TO "client_referrals";

-- Column renames
ALTER TABLE "payment_methods" RENAME COLUMN "owner_id" TO "client_id";
ALTER TABLE "pets" RENAME COLUMN "owner_id" TO "client_id";
ALTER TABLE "plans" RENAME COLUMN "owner_id" TO "client_id";
ALTER TABLE "plans" RENAME COLUMN "owner_referral_id" TO "client_referral_id";
ALTER TABLE "client_referrals" RENAME COLUMN "referrer_owner_id" TO "referrer_client_id";
ALTER TABLE "client_referrals" RENAME COLUMN "referred_owner_id" TO "referred_client_id";
ALTER TABLE "clinic_requests" RENAME COLUMN "owner_email" TO "client_email";
ALTER TABLE "clinic_requests" RENAME COLUMN "owner_name" TO "client_name";

-- Index renames
ALTER INDEX "idx_payment_methods_owner" RENAME TO "idx_payment_methods_client";
ALTER INDEX "idx_pets_owner" RENAME TO "idx_pets_client";
ALTER INDEX "idx_plans_owner" RENAME TO "idx_plans_client";
ALTER INDEX "idx_owner_referrals_referrer" RENAME TO "idx_client_referrals_referrer";
ALTER INDEX "idx_owner_referrals_code" RENAME TO "idx_client_referrals_code";

COMMIT;
