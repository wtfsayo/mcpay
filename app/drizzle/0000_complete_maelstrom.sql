CREATE TABLE "analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"date" timestamp NOT NULL,
	"total_requests" integer DEFAULT 0 NOT NULL,
	"total_revenue" numeric(18, 8) DEFAULT '0' NOT NULL,
	"unique_users" integer DEFAULT 0 NOT NULL,
	"avg_response_time" numeric(10, 2),
	"tool_usage" jsonb,
	"error_count" integer DEFAULT 0 NOT NULL,
	"user_ids_list" jsonb
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key_hash" text NOT NULL,
	"name" text NOT NULL,
	"permissions" text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"last_used_at" timestamp,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "mcp_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" text NOT NULL,
	"mcp_origin" text NOT NULL,
	"creator_id" uuid,
	"receiver_address" text NOT NULL,
	"require_auth" boolean DEFAULT false NOT NULL,
	"auth_headers" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"name" text,
	"description" text,
	"metadata" jsonb,
	CONSTRAINT "mcp_servers_server_id_unique" UNIQUE("server_id")
);
--> statement-breakpoint
CREATE TABLE "mcp_tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"input_schema" jsonb NOT NULL,
	"is_monetized" boolean DEFAULT false NOT NULL,
	"payment" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"user_id" uuid,
	"amount" numeric(18, 8) NOT NULL,
	"currency" text NOT NULL,
	"network" text NOT NULL,
	"transaction_hash" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"settled_at" timestamp,
	"signature" text,
	"payment_data" jsonb,
	CONSTRAINT "payments_transaction_hash_unique" UNIQUE("transaction_hash"),
	CONSTRAINT "amount_positive_check" CHECK ("amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "server_ownership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"granted_by" uuid,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_pricing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"price" numeric(18, 8) NOT NULL,
	"currency" text NOT NULL,
	"network" text NOT NULL,
	"asset_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "price_positive_check" CHECK ("price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tool_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"user_id" uuid,
	"request_data" jsonb,
	"response_status" text,
	"execution_time_ms" integer,
	"ip_address" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"email" text,
	"display_name" text,
	"avatar_url" text,
	"last_login_at" timestamp,
	CONSTRAINT "users_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"url" text NOT NULL,
	"secret" text,
	"events" text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_triggered_at" timestamp,
	"failure_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics" ADD CONSTRAINT "analytics_server_id_mcp_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."mcp_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_tools" ADD CONSTRAINT "mcp_tools_server_id_mcp_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."mcp_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tool_id_mcp_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."mcp_tools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_ownership" ADD CONSTRAINT "server_ownership_server_id_mcp_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."mcp_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_ownership" ADD CONSTRAINT "server_ownership_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_ownership" ADD CONSTRAINT "server_ownership_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_pricing" ADD CONSTRAINT "tool_pricing_tool_id_mcp_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."mcp_tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_usage" ADD CONSTRAINT "tool_usage_tool_id_mcp_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."mcp_tools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_usage" ADD CONSTRAINT "tool_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_server_id_mcp_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."mcp_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_server_id_idx" ON "analytics" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "analytics_date_idx" ON "analytics" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_server_date_idx" ON "analytics" USING btree ("server_id","date");--> statement-breakpoint
CREATE INDEX "api_key_user_id_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_key_active_idx" ON "api_keys" USING btree ("active");--> statement-breakpoint
CREATE INDEX "api_key_expires_at_idx" ON "api_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "mcp_server_status_idx" ON "mcp_servers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mcp_server_creator_idx" ON "mcp_servers" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "mcp_server_created_at_idx" ON "mcp_servers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "mcp_server_status_created_idx" ON "mcp_servers" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "mcp_tool_server_id_idx" ON "mcp_tools" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "mcp_tool_name_idx" ON "mcp_tools" USING btree ("name");--> statement-breakpoint
CREATE INDEX "mcp_tool_status_idx" ON "mcp_tools" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mcp_tool_server_name_idx" ON "mcp_tools" USING btree ("server_id","name");--> statement-breakpoint
CREATE INDEX "mcp_tool_monetized_idx" ON "mcp_tools" USING btree ("is_monetized");--> statement-breakpoint
CREATE INDEX "payment_tool_id_idx" ON "payments" USING btree ("tool_id");--> statement-breakpoint
CREATE INDEX "payment_user_id_idx" ON "payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payment_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_created_at_idx" ON "payments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payment_network_idx" ON "payments" USING btree ("network");--> statement-breakpoint
CREATE INDEX "payment_tool_user_idx" ON "payments" USING btree ("tool_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "server_ownership_server_user_idx" ON "server_ownership" USING btree ("server_id","user_id");--> statement-breakpoint
CREATE INDEX "server_ownership_server_id_idx" ON "server_ownership" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "server_ownership_user_id_idx" ON "server_ownership" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "server_ownership_active_idx" ON "server_ownership" USING btree ("active");--> statement-breakpoint
CREATE INDEX "tool_pricing_tool_id_idx" ON "tool_pricing" USING btree ("tool_id");--> statement-breakpoint
CREATE INDEX "tool_pricing_active_idx" ON "tool_pricing" USING btree ("active");--> statement-breakpoint
CREATE INDEX "tool_pricing_network_idx" ON "tool_pricing" USING btree ("network");--> statement-breakpoint
CREATE INDEX "tool_pricing_tool_network_idx" ON "tool_pricing" USING btree ("tool_id","network");--> statement-breakpoint
CREATE INDEX "tool_usage_tool_id_idx" ON "tool_usage" USING btree ("tool_id");--> statement-breakpoint
CREATE INDEX "tool_usage_user_id_idx" ON "tool_usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tool_usage_timestamp_idx" ON "tool_usage" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "tool_usage_status_idx" ON "tool_usage" USING btree ("response_status");--> statement-breakpoint
CREATE INDEX "tool_usage_tool_timestamp_idx" ON "tool_usage" USING btree ("tool_id","timestamp");--> statement-breakpoint
CREATE INDEX "user_wallet_address_idx" ON "users" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "user_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_last_login_idx" ON "users" USING btree ("last_login_at");--> statement-breakpoint
CREATE INDEX "webhook_server_id_idx" ON "webhooks" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "webhook_active_idx" ON "webhooks" USING btree ("active");--> statement-breakpoint
CREATE INDEX "webhook_failure_count_idx" ON "webhooks" USING btree ("failure_count");