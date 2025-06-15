"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ExternalLink,
  PenToolIcon as Tool,
  Globe,
  Moon,
  Sun,
  TrendingUp,
  AlertCircle,
  Loader2,
  Activity,
  DollarSign,
  Users,
  Zap,
  CheckCircle,
  Server,
} from "lucide-react"
import { ToolsModal, MCPServer } from "@/components/ToolsModal"
import { useTheme } from "@/context/ThemeContext"

// API response types
interface APITool {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  isMonetized: boolean;
  payment: Record<string, unknown> | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface APIServer {
  id: string;
  serverId: string;
  name: string;
  receiverAddress: string;
  description: string;
  metadata?: Record<string, unknown>;
  status: string;
  createdAt: string;
  updatedAt: string;
  tools: APITool[];
}

interface AnalyticsData {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  averageExecutionTime: number;
  totalRevenue: number;
  totalPayments: number;
  averagePaymentValue: number;
  totalServers: number;
  activeServers: number;
  totalTools: number;
  monetizedTools: number;
  uniqueUsers: number;
  totalProofs: number;
  consistentProofs: number;
  consistencyRate: number;
  topToolsByRequests: Array<{
    id: string;
    name: string;
    requests: number;
    revenue: number;
  }>;
  topToolsByRevenue: Array<{
    id: string;
    name: string;
    requests: number;
    revenue: number;
  }>;
  dailyActivity: Array<{
    date: string;
    requests: number;
    revenue: number;
    uniqueUsers: number;
  }>;
}

const transformServerData = (apiServer: APIServer): MCPServer => ({
  id: apiServer.serverId,
  name: apiServer.name || 'Unknown Server',
  description: apiServer.description || 'No description available',
  url: apiServer.receiverAddress,
  category: (apiServer.metadata as Record<string, unknown>)?.category as string || 'General',
  icon: <TrendingUp className="h-6 w-6" />,
  verified: apiServer.status === 'active',
  tools: apiServer.tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: {
      type: (tool.inputSchema as any)?.type || "object",
      properties: (tool.inputSchema as any)?.properties || {}
    },
    annotations: {
      title: tool.name,
      readOnlyHint: !tool.isMonetized,
      destructiveHint: false,
    },
  })),
});

const categories = [
  "All", "General", "Finance", "Automation", "Database", 
  "Development", "Productivity", "Utilities", "Communication", "AI/ML"
]

export default function MCPBrowser() {
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const { isDark, toggleTheme } = useTheme()

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setAnalyticsLoading(true)
        setAnalyticsError(null)
        
        const analyticsResponse = await fetch('https://api.mcpay.fun/api/analytics/usage')
        if (!analyticsResponse.ok) {
          throw new Error(`Failed to fetch analytics: ${analyticsResponse.status}`)
        }
        
        const analyticsData: AnalyticsData = await analyticsResponse.json()
        setAnalytics(analyticsData)
      } catch (err) {
        setAnalyticsError(err instanceof Error ? err.message : 'Failed to fetch analytics')
      } finally {
        setAnalyticsLoading(false)
      }
    }

    const fetchServers = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const serversResponse = await fetch('https://api.mcpay.fun/api/servers?limit=50&type=trending')
        if (!serversResponse.ok) {
          throw new Error(`Failed to fetch servers: ${serversResponse.status}`)
        }
        
        const servers: APIServer[] = await serversResponse.json()
        const transformedServers = servers.map(server => transformServerData(server))
        
        setMcpServers(transformedServers)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch servers')
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
    fetchServers()
  }, [])

  const filteredServers = mcpServers.filter(server => 
    selectedCategory === "All" || server.category === selectedCategory
  )

  const copyToClipboard = (text: string) => navigator.clipboard.writeText(text)

  // Format number with commas
  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null || isNaN(num)) return '0'
    return num.toLocaleString()
  }

  // Format currency
  const formatCurrency = (num: number | undefined | null) => {
    if (num === undefined || num === null || isNaN(num)) return '$0.00'
    return `$${num.toFixed(2)}`
  }

  // Stats card component
  const StatsCard = ({ 
    title, 
    value, 
    icon: Icon, 
    subtitle, 
    trend 
  }: { 
    title: string
    value: string | number
    icon: any
    subtitle?: string
    trend?: string
  }) => (
    <Card className="p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-full ${isDark ? "bg-blue-900/20" : "bg-blue-50"}`}>
          <Icon className={`h-6 w-6 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
        </div>
        <div className="ml-4 flex-1">
          <p className={`text-sm font-medium ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            {title}
          </p>
          <div className="flex items-baseline">
            <p className={`text-2xl font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
              {value}
            </p>
            {trend && (
              <p className={`ml-2 text-sm font-medium ${
                trend.startsWith('+') 
                  ? 'text-green-600' 
                  : trend.startsWith('-') 
                  ? 'text-red-600' 
                  : isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {trend}
              </p>
            )}
          </div>
          {subtitle && (
            <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </Card>
  )

  // Stats skeleton component
  const StatsSkeleton = () => (
    <Card className="p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-full animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`}>
          <div className="h-6 w-6" />
        </div>
        <div className="ml-4 flex-1 space-y-2">
          <div className={`h-4 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} style={{ width: '60%' }} />
          <div className={`h-6 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} style={{ width: '40%' }} />
          <div className={`h-3 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} style={{ width: '80%' }} />
        </div>
      </div>
    </Card>
  )

  // Skeleton card component
  const SkeletonCard = () => (
    <Card className="hover:shadow-lg transition-all duration-200">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg w-12 h-12 animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
          <div className="flex-1 space-y-2">
            <div className={`h-5 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} style={{ width: '60%' }} />
            <div className={`h-4 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} style={{ width: '40%' }} />
          </div>
        </div>
        <div className="space-y-2 mt-3">
          <div className={`h-3 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
          <div className={`h-3 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} style={{ width: '80%' }} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className={`h-4 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} style={{ width: '30%' }} />
          <div className={`h-8 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
        </div>
        <div className="space-y-2">
          <div className={`h-4 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} style={{ width: '50%' }} />
          <div className={`h-8 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
        </div>
        <div className={`h-10 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
      </CardContent>
    </Card>
  )

  // Error state
  if (error) {
    return (
      <div className={`min-h-screen ${isDark ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertCircle className={`h-12 w-12 mx-auto mb-4 ${isDark ? "text-red-400" : "text-red-500"}`} />
              <h3 className="text-lg font-medium mb-2">Failed to load MCP servers</h3>
              <p className={`mb-4 ${isDark ? "text-gray-400" : "text-gray-600"}`}>{error}</p>
              <Button onClick={() => window.location.reload()}>Try Again</Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${isDark ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className={`text-4xl font-bold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>
            Add a payment layer to your MCP servers
          </h1>
          <p className={`text-lg max-w-3xl mx-auto ${isDark ? "text-gray-300" : "text-gray-600"}`}>
            Connect with MCP servers to extend AI capabilities with external tools and data sources.
            Monetize your own server through the x402 protocol.
          </p>
        </div>

        {/* Platform Stats */}
        <div className="mb-12">
          <h2 className={`text-2xl font-bold text-center mb-8 ${isDark ? "text-white" : "text-gray-900"}`}>
            Platform Statistics
          </h2>
          
          {analyticsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, index) => (
                <StatsSkeleton key={`stats-skeleton-${index}`} />
              ))}
            </div>
          ) : analyticsError ? (
            <div className="text-center py-8">
              <AlertCircle className={`h-8 w-8 mx-auto mb-4 ${isDark ? "text-red-400" : "text-red-500"}`} />
              <p className={`text-sm ${isDark ? "text-red-400" : "text-red-500"}`}>
                Failed to load platform statistics
              </p>
            </div>
          ) : analytics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatsCard
                title="Total Servers"
                value={formatNumber(analytics.totalServers)}
                icon={Server}
                subtitle={`${analytics.activeServers} active`}
              />
              <StatsCard
                title="Available Tools"
                value={formatNumber(analytics.totalTools)}
                icon={Tool}
                subtitle={`${analytics.monetizedTools} monetized`}
              />
              <StatsCard
                title="Total Requests"
                value={formatNumber(analytics.totalRequests)}
                icon={Activity}
                subtitle={`${analytics.successRate}% success rate`}
              />
              <StatsCard
                title="Unique Users"
                value={formatNumber(analytics.uniqueUsers)}
                icon={Users}
                subtitle="Active developers"
              />
              <StatsCard
                title="Total Revenue"
                value={formatCurrency(analytics.totalRevenue)}
                icon={DollarSign}
                subtitle={`${formatNumber(analytics.totalPayments)} transactions`}
              />
              <StatsCard
                title="Avg Response Time"
                value={`${analytics.averageExecutionTime}ms`}
                icon={Zap}
                subtitle="Tool execution speed"
              />
              <StatsCard
                title="Verification Proofs"
                value={formatNumber(analytics.totalProofs)}
                icon={CheckCircle}
                subtitle={`${analytics.consistencyRate}% consistent`}
              />
              <StatsCard
                title="Avg Payment"
                value={formatCurrency(analytics.averagePaymentValue)}
                icon={TrendingUp}
                subtitle="Per transaction"
              />
            </div>
          ) : null}
        </div>

        {/* Category Filter */}
        <div className="flex justify-center mb-8">
          <div className="flex gap-2 flex-wrap">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                onClick={() => setSelectedCategory(category)}
                size="sm"
                disabled={loading}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Browse Servers Section */}
        <div className="mb-8">
          <h2 className={`text-2xl font-bold text-center mb-8 ${isDark ? "text-white" : "text-gray-900"}`}>
            Browse MCP Servers
          </h2>
        </div>

        {/* Results Count */}
        <div className="mb-6">
          {loading ? (
            <div className={`h-5 w-32 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
          ) : error ? (
            <div className="flex items-center gap-2">
              <AlertCircle className={`h-4 w-4 ${isDark ? "text-red-400" : "text-red-500"}`} />
              <p className={`${isDark ? "text-red-400" : "text-red-500"}`}>Failed to load servers</p>
            </div>
          ) : (
            <p className={isDark ? "text-gray-300" : "text-gray-600"}>
              {filteredServers.length} MCP server{filteredServers.length !== 1 ? "s" : ""} found
            </p>
          )}
        </div>

        {/* MCP Server Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {loading ? (
            // Show skeleton cards while loading
            Array.from({ length: 6 }).map((_, index) => (
              <SkeletonCard key={`skeleton-${index}`} />
            ))
          ) : error ? (
            // Show error message in grid area
            <div className="col-span-full text-center py-12">
              <AlertCircle className={`h-12 w-12 mx-auto mb-4 ${isDark ? "text-red-400" : "text-red-500"}`} />
              <h3 className="text-lg font-medium mb-2">Failed to load MCP servers</h3>
              <p className={`mb-4 ${isDark ? "text-gray-400" : "text-gray-600"}`}>{error}</p>
              <Button onClick={() => window.location.reload()}>Try Again</Button>
            </div>
          ) : filteredServers.length === 0 ? (
            // Show empty state
            <div className="col-span-full text-center py-12">
              <Globe className={`h-12 w-12 mx-auto mb-4 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
              <h3 className="text-lg font-medium mb-2">No MCP servers found</h3>
              <p className={isDark ? "text-gray-400" : "text-gray-600"}>
                {mcpServers.length === 0 ? "No servers are currently registered." : "Try a different category."}
              </p>
            </div>
          ) : (
            // Show actual server cards
            filteredServers.map((server) => (
              <Card key={server.id} className="hover:shadow-lg transition-all duration-200">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-100"}`}>
                      {server.icon}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {server.name}
                        {server.verified && <Badge variant="secondary" className="text-xs">Verified</Badge>}
                      </CardTitle>
                      <Badge variant="outline" className="text-xs mt-1">{server.category}</Badge>
                    </div>
                  </div>
                  <CardDescription className="text-sm leading-relaxed h-12 line-clamp-2">
                    {server.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* URL */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">MCP URL</label>
                    <div className="flex items-center gap-2">
                      <code className={`flex-1 text-xs p-2 rounded border font-mono break-all ${
                        isDark ? "bg-gray-700 border-gray-600" : "bg-gray-100 border-gray-200"
                      }`}>
                        {`https://api.mcpay.fun/mcp/${server.id}`}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(`https://api.mcpay.fun/mcp/${server.id}`)}
                        className="shrink-0"
                      >
                        Copy
                      </Button>
                    </div>
                  </div>

                  {/* Tools */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Tool className="h-4 w-4" />
                      Available Tools ({server.tools.length})
                    </label>
                    <ToolsModal server={server} />
                  </div>

                  {/* Actions */}
                  <Button size="sm" variant="outline" asChild className="w-full">
                    <Link href={`/servers/${server.id}`}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Dashboard
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Footer */}
        <div className={`text-center text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
          <div className="flex items-center justify-center gap-4">
            <p>
              Learn more about Model Context Protocol at{" "}
              <a href="https://modelcontextprotocol.io" className="hover:underline">
                modelcontextprotocol.io
              </a>
            </p>
            <Button variant="ghost" size="sm" onClick={toggleTheme} className="flex items-center gap-2">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {isDark ? "Light" : "Dark"} Mode
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
