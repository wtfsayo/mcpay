CREATE TABLE "user_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wallet_address" text NOT NULL,
	"wallet_type" text NOT NULL,
	"provider" text,
	"blockchain" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"wallet_metadata" jsonb,
	"external_wallet_id" text,
	"external_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	CONSTRAINT "user_wallets_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_wallets_user_id_idx" ON "user_wallets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_wallets_wallet_address_idx" ON "user_wallets" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "user_wallets_type_idx" ON "user_wallets" USING btree ("wallet_type");--> statement-breakpoint
CREATE INDEX "user_wallets_blockchain_idx" ON "user_wallets" USING btree ("blockchain");--> statement-breakpoint
CREATE INDEX "user_wallets_primary_idx" ON "user_wallets" USING btree ("is_primary");--> statement-breakpoint
CREATE INDEX "user_wallets_active_idx" ON "user_wallets" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "user_wallets_provider_idx" ON "user_wallets" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "user_wallets_external_id_idx" ON "user_wallets" USING btree ("external_wallet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_wallets_primary_unique" ON "user_wallets" USING btree ("user_id") WHERE is_primary = true;