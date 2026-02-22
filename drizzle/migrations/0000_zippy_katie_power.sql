CREATE TYPE "public"."actor_type" AS ENUM('system', 'admin', 'owner', 'clinic');--> statement-breakpoint
CREATE TYPE "public"."clinic_status" AS ENUM('pending', 'active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('debit_card', 'bank_account');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'processing', 'succeeded', 'failed', 'retried', 'written_off');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('deposit', 'installment');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('pending', 'deposit_paid', 'active', 'completed', 'defaulted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."risk_pool_type" AS ENUM('contribution', 'claim', 'recovery');--> statement-breakpoint
CREATE TYPE "public"."soft_collection_stage" AS ENUM('day_1_reminder', 'day_7_followup', 'day_14_final', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" uuid,
	"ip_address" "inet",
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clinics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_id" text,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"address_line1" text,
	"address_city" text,
	"address_state" text NOT NULL,
	"address_zip" text NOT NULL,
	"stripe_account_id" text,
	"status" "clinic_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "clinics_auth_id_unique" UNIQUE("auth_id"),
	CONSTRAINT "clinics_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_id" text,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"address_line1" text,
	"address_city" text,
	"address_state" text,
	"address_zip" text,
	"pet_name" text NOT NULL,
	"stripe_customer_id" text,
	"stripe_card_payment_method_id" text,
	"stripe_ach_payment_method_id" text,
	"plaid_access_token" text,
	"plaid_item_id" text,
	"payment_method" "payment_method" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "owners_auth_id_unique" UNIQUE("auth_id"),
	CONSTRAINT "owners_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid,
	"type" "payment_type" NOT NULL,
	"sequence_num" integer,
	"amount_cents" integer NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"stripe_payment_intent_id" text,
	"failure_reason" text,
	"retry_count" integer DEFAULT 0,
	"scheduled_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "uq_payments_plan_sequence" UNIQUE("plan_id","sequence_num"),
	CONSTRAINT "ck_payments_amount_positive" CHECK ("payments"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid,
	"plan_id" uuid,
	"payment_id" uuid,
	"amount_cents" integer NOT NULL,
	"clinic_share_cents" integer NOT NULL,
	"stripe_transfer_id" text,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ck_payouts_amount_positive" CHECK ("payouts"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"clinic_id" uuid,
	"total_bill_cents" integer NOT NULL,
	"fee_cents" integer NOT NULL,
	"total_with_fee_cents" integer NOT NULL,
	"deposit_cents" integer NOT NULL,
	"remaining_cents" integer NOT NULL,
	"installment_cents" integer NOT NULL,
	"num_installments" integer DEFAULT 6 NOT NULL,
	"status" "plan_status" DEFAULT 'pending' NOT NULL,
	"deposit_paid_at" timestamp with time zone,
	"next_payment_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "risk_pool" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid,
	"contribution_cents" integer NOT NULL,
	"type" "risk_pool_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "soft_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"stage" "soft_collection_stage" DEFAULT 'day_1_reminder' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"last_escalated_at" timestamp with time zone,
	"next_escalation_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "soft_collections_plan_id_unique" UNIQUE("plan_id")
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_pool" ADD CONSTRAINT "risk_pool_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soft_collections" ADD CONSTRAINT "soft_collections_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_entity" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_clinics_stripe_account" ON "clinics" USING btree ("stripe_account_id");--> statement-breakpoint
CREATE INDEX "idx_owners_plaid_item" ON "owners" USING btree ("plaid_item_id");--> statement-breakpoint
CREATE INDEX "idx_payments_plan" ON "payments" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "idx_payments_scheduled" ON "payments" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_payments_status" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payments_stripe_pi" ON "payments" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "idx_payouts_clinic" ON "payouts" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "idx_payouts_payment" ON "payouts" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_plans_clinic" ON "plans" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "idx_plans_owner" ON "plans" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_plans_status" ON "plans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_soft_collections_plan" ON "soft_collections" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "idx_soft_collections_stage" ON "soft_collections" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "idx_soft_collections_next_escalation" ON "soft_collections" USING btree ("next_escalation_at");