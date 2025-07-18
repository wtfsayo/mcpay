ALTER TABLE "payments" DROP CONSTRAINT "amount_positive_check";--> statement-breakpoint
ALTER TABLE "tool_pricing" DROP CONSTRAINT "price_positive_check";--> statement-breakpoint
ALTER TABLE "analytics" ADD COLUMN "total_revenue_raw" numeric(38, 0) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "amount_raw" numeric(38, 0) NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "token_decimals" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "tool_pricing" ADD COLUMN "price_raw" numeric(38, 0) NOT NULL;--> statement-breakpoint
ALTER TABLE "tool_pricing" ADD COLUMN "token_decimals" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics" DROP COLUMN "total_revenue";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "amount";--> statement-breakpoint
ALTER TABLE "tool_pricing" DROP COLUMN "price";--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "amount_raw_positive_check" CHECK ("amount_raw" >= 0);--> statement-breakpoint
ALTER TABLE "tool_pricing" ADD CONSTRAINT "price_raw_positive_check" CHECK ("price_raw" >= 0);