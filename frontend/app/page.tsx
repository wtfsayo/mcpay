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
  const { isDark, toggleTheme } = useTheme()

  useEffect(() => {
    const fetchServers = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const serversResponse = await fetch('https://api.mcpay.fun/api/servers?limit=50')
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

    fetchServers()
  }, [])

  const filteredServers = mcpServers.filter(server => 
    selectedCategory === "All" || server.category === selectedCategory
  )

  const copyToClipboard = (text: string) => navigator.clipboard.writeText(text)

  // Loading state
  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className={isDark ? "text-gray-300" : "text-gray-600"}>Loading MCP servers...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

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
            The easiest way to monetize and use MCP servers
          </h1>
          <p className={`text-lg max-w-3xl mx-auto ${isDark ? "text-gray-300" : "text-gray-600"}`}>
            Connect with MCP servers to extend AI capabilities with external tools and data sources.
            Monetize your own server through the x402 protocol.
          </p>
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
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className={isDark ? "text-gray-300" : "text-gray-600"}>
            {filteredServers.length} MCP server{filteredServers.length !== 1 ? "s" : ""} found
          </p>
        </div>

        {/* MCP Server Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredServers.map((server) => (
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
          ))}
        </div>

        {/* Empty State */}
        {filteredServers.length === 0 && (
          <div className="text-center py-12">
            <Globe className={`h-12 w-12 mx-auto mb-4 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
            <h3 className="text-lg font-medium mb-2">No MCP servers found</h3>
            <p className={isDark ? "text-gray-400" : "text-gray-600"}>
              {mcpServers.length === 0 ? "No servers are currently registered." : "Try a different category."}
            </p>
          </div>
        )}

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
