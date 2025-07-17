ALTER TABLE "user_wallets" ADD COLUMN "architecture" text;--> statement-breakpoint
CREATE INDEX "user_wallets_architecture_idx" ON "user_wallets" USING btree ("architecture");