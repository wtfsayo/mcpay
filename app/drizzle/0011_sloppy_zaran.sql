ALTER TABLE "tool_usage" ADD COLUMN "pricing_id" uuid;--> statement-breakpoint
ALTER TABLE "tool_usage" ADD CONSTRAINT "tool_usage_pricing_id_tool_pricing_id_fk" FOREIGN KEY ("pricing_id") REFERENCES "public"."tool_pricing"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tool_usage_pricing_id_idx" ON "tool_usage" USING btree ("pricing_id");--> statement-breakpoint
CREATE INDEX "tool_usage_tool_pricing_idx" ON "tool_usage" USING btree ("tool_id","pricing_id");