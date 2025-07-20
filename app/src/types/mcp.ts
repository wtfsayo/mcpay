import { txOperations } from "@/lib/gateway/db/actions";
import { mcpTools } from "@/lib/gateway/db/schema";

export type McpServerList = Awaited<ReturnType<ReturnType<typeof txOperations.listMcpServers>>>;
export type McpServerWithRelations = McpServerList[number];
export type McpServerWithActivity = Awaited<ReturnType<ReturnType<typeof txOperations.listMcpServersByActivity>>>[number];

export type McpServerWithStats = Awaited<ReturnType<ReturnType<typeof txOperations.getMcpServerWithStats>>>

export type ToolFromMcpServerWithStats = NonNullable<McpServerWithStats>['tools'][number];


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



// Types based on the database schema - matching the actual schema.ts structure
interface ServerTool {
    id: string
    name: string
    description: string
    inputSchema: Record<string, unknown>
    isMonetized: boolean
    payment?: Record<string, unknown>
    status: string
    metadata?: Record<string, unknown>
    createdAt: string
    updatedAt: string
    pricing: Array<{
      id: string
      priceRaw: string // Base units as string (from NUMERIC(38,0))
      tokenDecimals: number // Decimals for the token
      currency: string // Token symbol or contract address
      network: string
      assetAddress?: string
      active: boolean
      createdAt: string
      updatedAt: string
    }>
    payments: Array<{
      id: string
      amountRaw: string // Base units as string (from NUMERIC(38,0))
      tokenDecimals: number // Decimals for the token
      currency: string // Token symbol or contract address
      network: string
      status: string
      createdAt: string
      settledAt?: string
      transactionHash?: string
      user: {
        id: string
        walletAddress?: string
        displayName?: string
        name?: string
      }
    }>
    usage: Array<{
      id: string
      timestamp: string
      responseStatus?: string
      executionTimeMs?: number
      user: {
        id: string
        walletAddress?: string
        displayName?: string
        name?: string
      }
    }>
    proofs: Array<{
      id: string
      isConsistent: boolean
      confidenceScore: string // Decimal as string
      status: string
      verificationType: string
      createdAt: string
      webProofPresentation?: string
      user: {
        id: string
        walletAddress?: string
        displayName?: string
        name?: string
      }
    }>
  }
  
  // Type for the converted tool format used by ToolExecutionModal
  interface ConvertedTool extends Omit<ServerTool, 'pricing'> {
    pricing: Array<{
      id: string
      price: string
      currency: string
      network: string
      assetAddress: string
      active: boolean
    }>
  }
  
  interface ServerData {
    id: string
    serverId: string
    name?: string
    mcpOrigin: string
    receiverAddress: string
    description?: string
    metadata?: Record<string, unknown>
    status: string
    createdAt: string
    updatedAt: string
    creator: {
      id: string
      walletAddress?: string
      displayName?: string
      name?: string
      avatarUrl?: string
      image?: string // From better-auth
    }
    tools: ServerTool[]
    analytics: Array<{
      id: string
      date: string
      totalRequests: number
      totalRevenueRaw: string // Deprecated - base units as string
      revenueByCurrency?: Record<string, string> // New multi-currency format: { "USDC-6": "1000000" }
      uniqueUsers: number
      avgResponseTime?: string // Decimal as string
      toolUsage?: Record<string, number>
      errorCount: number
    }>
    ownership: Array<{
      id: string
      role: string
      createdAt: string
      active: boolean
      user: {
        id: string
        walletAddress?: string
        displayName?: string
        name?: string
        avatarUrl?: string
        image?: string
      }
      grantedByUser?: {
        id: string
        walletAddress?: string
        displayName?: string
        name?: string
      }
    }>
    proofs: Array<{
      id: string
      isConsistent: boolean
      confidenceScore: string // Decimal as string
      status: string
      verificationType: string
      createdAt: string
      webProofPresentation?: string
      tool: {
        id: string
        name: string
      }
      user: {
        id: string
        walletAddress?: string
        displayName?: string
        name?: string
      }
    }>
    stats: {
      totalTools: number
      monetizedTools: number
      totalPayments: number
      totalRevenue: number // Computed value in USD
      totalUsage: number
      totalProofs: number
      consistentProofs: number
      proofsWithWebProof: number
      uniqueUsers: number
      avgResponseTime: number
      reputationScore: number
      lastActivity: string
    }
  }
  