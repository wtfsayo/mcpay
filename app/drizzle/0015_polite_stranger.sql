DROP VIEW "public"."daily_activity";--> statement-breakpoint
DROP VIEW "public"."daily_server_analytics";--> statement-breakpoint
DROP VIEW "public"."global_analytics";--> statement-breakpoint
DROP VIEW "public"."server_summary_analytics";--> statement-breakpoint
DROP VIEW "public"."tool_analytics";--> statement-breakpoint
CREATE VIEW "public"."daily_activity" AS (select activity_date as "date", COUNT(DISTINCT tool_usage.id) as "total_requests", COUNT(DISTINCT COALESCE(tool_usage.user_id, payments.user_id)) as "unique_users", COUNT(DISTINCT CASE WHEN payments.status = 'completed' THEN payments.id END) as "total_payments", AVG(tool_usage.execution_time_ms) as "avg_response_time", 
        CASE 
          WHEN COUNT(DISTINCT CASE WHEN payments.status = 'completed' AND payments.amount_raw IS NOT NULL THEN payments.id END) > 0 THEN
            JSON_AGG(
              DISTINCT JSONB_BUILD_OBJECT(
                'currency', payments.currency,
                'network', payments.network,
                'decimals', payments.token_decimals,
                'amount_raw', (
                  SELECT SUM(p2.amount_raw::numeric)::text
                  FROM payments p2
                  WHERE DATE(p2.created_at) = dates.activity_date
                    AND p2.status = 'completed'
                    AND p2.currency = payments.currency
                    AND p2.network = payments.network
                    AND p2.token_decimals = payments.token_decimals
                )
              )
            ) FILTER (WHERE payments.status = 'completed' AND payments.amount_raw IS NOT NULL)
          ELSE NULL
        END
       as "revenue_details" from (
      SELECT DISTINCT DATE(timestamp) as activity_date FROM tool_usage
      UNION
      SELECT DISTINCT DATE(created_at) as activity_date FROM payments
    ) dates left join "tool_usage" on DATE(tool_usage.timestamp) = dates.activity_date left join "payments" on DATE(payments.created_at) = dates.activity_date group by activity_date order by activity_date DESC);--> statement-breakpoint
CREATE VIEW "public"."daily_server_analytics" AS (select mcp_servers.id as "server_id", server_dates.activity_date as "date", COUNT(DISTINCT tool_usage.id) as "total_requests", COUNT(DISTINCT COALESCE(tool_usage.user_id, payments.user_id)) as "unique_users", COUNT(DISTINCT CASE WHEN tool_usage.response_status NOT IN ('success', '200') THEN tool_usage.id END) as "error_count", AVG(tool_usage.execution_time_ms) as "avg_response_time", 
        CASE 
          WHEN COUNT(DISTINCT CASE WHEN payments.status = 'completed' AND payments.amount_raw IS NOT NULL THEN payments.id END) > 0 THEN
            JSON_AGG(
              DISTINCT JSONB_BUILD_OBJECT(
                'currency', payments.currency,
                'network', payments.network,
                'decimals', payments.token_decimals,
                'amount_raw', (
                  SELECT SUM(p2.amount_raw::numeric)::text
                  FROM payments p2
                  JOIN mcp_tools t2 ON t2.id = p2.tool_id
                  WHERE t2.server_id = mcp_servers.id
                    AND DATE(p2.created_at) = server_dates.activity_date
                    AND p2.status = 'completed'
                    AND p2.currency = payments.currency
                    AND p2.network = payments.network
                    AND p2.token_decimals = payments.token_decimals
                )
              )
            ) FILTER (WHERE payments.status = 'completed' AND payments.amount_raw IS NOT NULL)
          ELSE NULL
        END
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
    ) server_dates left join "mcp_servers" on mcp_servers.id = server_dates.server_id left join "mcp_tools" on mcp_tools.server_id = mcp_servers.id left join "tool_usage" on tool_usage.tool_id = mcp_tools.id AND DATE(tool_usage.timestamp) = server_dates.activity_date left join "payments" on payments.tool_id = mcp_tools.id AND DATE(payments.created_at) = server_dates.activity_date group by mcp_servers.id, server_dates.activity_date);--> statement-breakpoint
CREATE VIEW "public"."global_analytics" AS (select COUNT(DISTINCT mcp_servers.id) as "total_servers", COUNT(DISTINCT CASE WHEN mcp_servers.status = 'active' THEN mcp_servers.id END) as "active_servers", COUNT(DISTINCT mcp_tools.id) as "total_tools", COUNT(DISTINCT CASE WHEN mcp_tools.is_monetized THEN mcp_tools.id END) as "monetized_tools", COUNT(DISTINCT tool_usage.id) as "total_requests", COUNT(DISTINCT CASE WHEN tool_usage.response_status IN ('success', '200') THEN tool_usage.id END) as "successful_requests", COUNT(DISTINCT COALESCE(tool_usage.user_id, payments.user_id)) as "unique_users", COUNT(DISTINCT CASE WHEN payments.status = 'completed' THEN payments.id END) as "total_payments", AVG(tool_usage.execution_time_ms) as "avg_response_time", 
        CASE 
          WHEN COUNT(DISTINCT CASE WHEN payments.status = 'completed' AND payments.amount_raw IS NOT NULL THEN payments.id END) > 0 THEN
            JSON_AGG(
              DISTINCT JSONB_BUILD_OBJECT(
                'currency', payments.currency,
                'network', payments.network,
                'decimals', payments.token_decimals,
                'amount_raw', (
                  SELECT SUM(p2.amount_raw::numeric)::text
                  FROM payments p2
                  WHERE p2.status = 'completed'
                    AND p2.currency = payments.currency
                    AND p2.network = payments.network
                    AND p2.token_decimals = payments.token_decimals
                )
              )
            ) FILTER (WHERE payments.status = 'completed' AND payments.amount_raw IS NOT NULL)
          ELSE NULL
        END
       as "revenue_details", COUNT(DISTINCT proofs.id) as "total_proofs", COUNT(DISTINCT CASE WHEN proofs.is_consistent THEN proofs.id END) as "consistent_proofs" from "mcp_servers" left join "mcp_tools" on mcp_tools.server_id = mcp_servers.id left join "tool_usage" on tool_usage.tool_id = mcp_tools.id left join "payments" on payments.tool_id = mcp_tools.id left join "proofs" on proofs.server_id = mcp_servers.id);--> statement-breakpoint
CREATE VIEW "public"."server_summary_analytics" AS (select mcp_servers.id as "server_id", mcp_servers.name as "server_name", COUNT(DISTINCT tool_usage.id) as "total_requests", COUNT(DISTINCT mcp_tools.id) as "total_tools", COUNT(DISTINCT CASE WHEN mcp_tools.is_monetized THEN mcp_tools.id END) as "monetized_tools", COUNT(DISTINCT COALESCE(tool_usage.user_id, payments.user_id)) as "unique_users", COUNT(DISTINCT CASE WHEN payments.status = 'completed' THEN payments.id END) as "total_payments", COUNT(DISTINCT CASE WHEN tool_usage.response_status NOT IN ('success', '200') THEN tool_usage.id END) as "error_count", AVG(tool_usage.execution_time_ms) as "avg_response_time", 
        CASE 
          WHEN COUNT(DISTINCT tool_usage.id) > 0 THEN
            (COUNT(DISTINCT CASE WHEN tool_usage.response_status IN ('success', '200') THEN tool_usage.id END)::float / COUNT(DISTINCT tool_usage.id)) * 100
          ELSE 0
        END
       as "success_rate", 
        CASE 
          WHEN COUNT(DISTINCT CASE WHEN payments.status = 'completed' AND payments.amount_raw IS NOT NULL THEN payments.id END) > 0 THEN
            JSON_AGG(
              DISTINCT JSONB_BUILD_OBJECT(
                'currency', payments.currency,
                'network', payments.network,
                'decimals', payments.token_decimals,
                'amount_raw', (
                  SELECT SUM(p2.amount_raw::numeric)::text
                  FROM payments p2
                  JOIN mcp_tools t2 ON t2.id = p2.tool_id
                  WHERE t2.server_id = mcp_servers.id
                    AND p2.status = 'completed'
                    AND p2.currency = payments.currency
                    AND p2.network = payments.network
                    AND p2.token_decimals = payments.token_decimals
                )
              )
            ) FILTER (WHERE payments.status = 'completed' AND payments.amount_raw IS NOT NULL)
          ELSE NULL
        END
       as "revenue_details", 
        COUNT(DISTINCT CASE 
          WHEN tool_usage.timestamp > NOW() - INTERVAL '30 days' 
          THEN tool_usage.id 
        END)
       as "recent_requests", 
        COUNT(DISTINCT CASE 
          WHEN payments.created_at > NOW() - INTERVAL '30 days' AND payments.status = 'completed' 
          THEN payments.id 
        END)
       as "recent_payments", 
        GREATEST(
          MAX(tool_usage.timestamp),
          MAX(payments.created_at)
        )
       as "last_activity" from "mcp_servers" left join "mcp_tools" on mcp_tools.server_id = mcp_servers.id left join "tool_usage" on tool_usage.tool_id = mcp_tools.id left join "payments" on payments.tool_id = mcp_tools.id group by mcp_servers.id, mcp_servers.name);--> statement-breakpoint
CREATE VIEW "public"."tool_analytics" AS (select mcp_tools.id as "tool_id", mcp_tools.name as "tool_name", mcp_tools.server_id as "server_id", mcp_tools.is_monetized as "is_monetized", COUNT(DISTINCT tool_usage.id) as "total_requests", COUNT(DISTINCT CASE WHEN tool_usage.response_status IN ('success', '200') THEN tool_usage.id END) as "successful_requests", COUNT(DISTINCT tool_usage.user_id) as "unique_users", AVG(tool_usage.execution_time_ms) as "avg_response_time", COUNT(DISTINCT CASE WHEN payments.status = 'completed' THEN payments.id END) as "total_payments", 
        CASE 
          WHEN COUNT(DISTINCT CASE WHEN payments.status = 'completed' AND payments.amount_raw IS NOT NULL THEN payments.id END) > 0 THEN
            JSON_AGG(
              DISTINCT JSONB_BUILD_OBJECT(
                'currency', payments.currency,
                'network', payments.network,
                'decimals', payments.token_decimals,
                'amount_raw', (
                  SELECT SUM(p2.amount_raw::numeric)::text
                  FROM payments p2
                  WHERE p2.tool_id = mcp_tools.id
                    AND p2.status = 'completed'
                    AND p2.currency = payments.currency
                    AND p2.network = payments.network
                    AND p2.token_decimals = payments.token_decimals
                )
              )
            ) FILTER (WHERE payments.status = 'completed' AND payments.amount_raw IS NOT NULL)
          ELSE NULL
        END
       as "revenue_details", MAX(tool_usage.timestamp) as "last_used", 
        COUNT(DISTINCT CASE 
          WHEN tool_usage.timestamp > NOW() - INTERVAL '30 days' 
          THEN tool_usage.id 
        END)
       as "recent_requests" from "mcp_tools" left join "tool_usage" on tool_usage.tool_id = mcp_tools.id left join "payments" on payments.tool_id = mcp_tools.id group by mcp_tools.id, mcp_tools.name, mcp_tools.server_id, mcp_tools.is_monetized);