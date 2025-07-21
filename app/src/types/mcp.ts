import { txOperations } from "@/lib/gateway/db/actions";
import { mcpTools } from "@/lib/gateway/db/schema";
import { experimental_createMCPClient } from "ai";

export type McpServerList = Awaited<ReturnType<ReturnType<typeof txOperations.listMcpServers>>>;
export type McpServerWithRelations = McpServerList[number];
export type McpServerWithActivity = Awaited<ReturnType<ReturnType<typeof txOperations.listMcpServersByActivity>>>[number];

export type McpServerWithStats = Awaited<ReturnType<ReturnType<typeof txOperations.getMcpServerWithStats>>>

export type DailyServerAnalytics = Awaited<ReturnType<ReturnType<typeof txOperations.getDailyServerAnalytics>>>;

export type ToolFromMcpServerWithStats = NonNullable<McpServerWithStats>['tools'][number];

export type ServerSummaryAnalytics = Awaited<ReturnType<ReturnType<typeof txOperations.getServerSummaryAnalytics>>>;

export type MCPClient = Awaited<ReturnType<typeof experimental_createMCPClient>>
export type MCPToolsCollection = Record<string, unknown>


export interface InputProperty {
  type: string
  description?: string
  enum?: string[]
  default?: unknown
  minimum?: number
  maximum?: number
}

export interface ToolInputSchema {
  type?: string
  properties?: Record<string, InputProperty>
  required?: string[]
}

export interface ToolExecutionModalProps {
  isOpen: boolean
  onClose: () => void
  tool: ToolFromMcpServerWithStats | null
  serverId: string
}
export interface MCPToolInputSchema {
  jsonSchema?: {
    properties?: Record<string, InputProperty>
    required?: string[]
  }
}

export interface MCPToolFromClient {
  name?: string
  description?: string
  parameters?: MCPToolInputSchema
  inputSchema?: MCPToolInputSchema
  execute?: (params: Record<string, unknown>, options: { toolCallId: string; messages: unknown[] }) => Promise<unknown>
}


export type MCPTool = typeof mcpTools.$inferSelect;


export interface RegisterMCPTool {
  name: string
  description: string
  inputSchema: {
    jsonSchema: {
      type: string
      properties: Record<string, unknown>
      required?: string[]
      additionalProperties?: boolean
    }
  }
  price?: string
}