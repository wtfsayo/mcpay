ALTER TABLE "payments" DROP CONSTRAINT "payments_tool_id_mcp_tools_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tool_id_mcp_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."mcp_tools"("id") ON DELETE cascade ON UPDATE no action;