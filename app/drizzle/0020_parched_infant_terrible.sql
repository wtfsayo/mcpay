CREATE INDEX "mcp_server_origin_idx" ON "mcp_servers" USING btree ("mcp_origin");--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_mcp_origin_unique" UNIQUE("mcp_origin");