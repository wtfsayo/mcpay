ALTER TABLE "tool_usage" DROP CONSTRAINT "tool_usage_tool_id_mcp_tools_id_fk";
--> statement-breakpoint
ALTER TABLE "tool_usage" ADD CONSTRAINT "tool_usage_tool_id_mcp_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."mcp_tools"("id") ON DELETE cascade ON UPDATE no action;