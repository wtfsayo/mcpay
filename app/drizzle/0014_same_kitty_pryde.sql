DROP VIEW "public"."daily_activity";--> statement-breakpoint
DROP VIEW "public"."daily_server_analytics";--> statement-breakpoint
CREATE VIEW "public"."daily_activity" AS (select activity_date as "date", COUNT(DISTINCT tool_usage.id) as "total_requests", COUNT(DISTINCT COALESCE(tool_usage.user_id, payments.user_id)) as "unique_users", COUNT(DISTINCT CASE WHEN payments.status = 'completed' THEN payments.id END) as "total_payments", AVG(tool_usage.execution_time_ms) as "avg_response_time", 
        JSON_AGG(
          JSONB_BUILD_OBJECT(
            'currency', payments.currency,
            'network', payments.network,
            'decimals', payments.token_decimals,
            'amount_raw', payments.amount_raw
          )
        ) FILTER (WHERE payments.status = 'completed' AND payments.amount_raw IS NOT NULL)
       as "revenue_details" from (
      SELECT DISTINCT DATE(timestamp) as activity_date FROM tool_usage
      UNION
      SELECT DISTINCT DATE(created_at) as activity_date FROM payments
    ) dates left join "tool_usage" on DATE(tool_usage.timestamp) = dates.activity_date left join "payments" on DATE(payments.created_at) = dates.activity_date group by activity_date order by activity_date DESC);--> statement-breakpoint
CREATE VIEW "public"."daily_server_analytics" AS (select mcp_servers.id as "server_id", server_dates.activity_date as "date", COUNT(DISTINCT tool_usage.id) as "total_requests", COUNT(DISTINCT COALESCE(tool_usage.user_id, payments.user_id)) as "unique_users", COUNT(DISTINCT CASE WHEN tool_usage.response_status NOT IN ('success', '200') THEN tool_usage.id END) as "error_count", AVG(tool_usage.execution_time_ms) as "avg_response_time", 
        JSON_AGG(
          JSONB_BUILD_OBJECT(
            'currency', payments.currency,
            'network', payments.network,
            'decimals', payments.token_decimals,
            'amount_raw', payments.amount_raw
          )
        ) FILTER (WHERE payments.status = 'completed' AND payments.amount_raw IS NOT NULL)
       as "revenue_details", COUNT(DISTINCT CASE WHEN payments.status = 'completed' THEN payments.id END) as "total_payments" from (
      SELECT DISTINCT 
        mcp_servers.id as server_id,
        dates.activity_date
      FROM mcp_servers
      CROSS JOIN (
        SELECT DISTINCT DATE(timestamp) as activity_date FROM tool_usage
        UNION
        SELECT DISTINCT DATE(created_at) as activity_date FROM payments
      ) dates
    ) server_dates left join "mcp_servers" on mcp_servers.id = server_dates.server_id left join "mcp_tools" on mcp_tools.server_id = mcp_servers.id left join "tool_usage" on tool_usage.tool_id = mcp_tools.id AND DATE(tool_usage.timestamp) = server_dates.activity_date left join "payments" on payments.tool_id = mcp_tools.id AND DATE(payments.created_at) = server_dates.activity_date group by mcp_servers.id, server_dates.activity_date);