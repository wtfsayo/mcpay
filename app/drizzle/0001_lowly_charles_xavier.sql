CREATE TABLE "proofs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"server_id" uuid NOT NULL,
	"user_id" uuid,
	"is_consistent" boolean NOT NULL,
	"confidence_score" numeric(3, 2) NOT NULL,
	"execution_url" text,
	"execution_method" text,
	"execution_headers" jsonb,
	"execution_params" jsonb NOT NULL,
	"execution_result" jsonb NOT NULL,
	"execution_timestamp" timestamp NOT NULL,
	"ai_evaluation" text NOT NULL,
	"inconsistencies" jsonb,
	"web_proof_presentation" text,
	"notary_url" text,
	"proof_metadata" jsonb,
	"replay_execution_result" jsonb,
	"replay_execution_timestamp" timestamp,
	"status" text DEFAULT 'verified' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"verification_type" text DEFAULT 'execution' NOT NULL,
	CONSTRAINT "confidence_score_range_check" CHECK ("confidence_score" >= 0 AND "confidence_score" <= 1)
);
--> statement-breakpoint
ALTER TABLE "proofs" ADD CONSTRAINT "proofs_tool_id_mcp_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."mcp_tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proofs" ADD CONSTRAINT "proofs_server_id_mcp_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."mcp_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proofs" ADD CONSTRAINT "proofs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "proof_tool_id_idx" ON "proofs" USING btree ("tool_id");--> statement-breakpoint
CREATE INDEX "proof_server_id_idx" ON "proofs" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "proof_user_id_idx" ON "proofs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "proof_status_idx" ON "proofs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "proof_created_at_idx" ON "proofs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "proof_is_consistent_idx" ON "proofs" USING btree ("is_consistent");--> statement-breakpoint
CREATE INDEX "proof_confidence_score_idx" ON "proofs" USING btree ("confidence_score");--> statement-breakpoint
CREATE INDEX "proof_verification_type_idx" ON "proofs" USING btree ("verification_type");--> statement-breakpoint
CREATE INDEX "proof_tool_created_idx" ON "proofs" USING btree ("tool_id","created_at");--> statement-breakpoint
CREATE INDEX "proof_server_consistent_idx" ON "proofs" USING btree ("server_id","is_consistent");