"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import {
  Search,
  // ExternalLink,
  PenToolIcon as Tool,
  // Database,
  Globe,
  // Zap,
  // FileText,
  // Calculator,
  // Calendar,
  // Mail,
  // Code,
  // ImageIcon,
  Moon,
  Sun,
  TrendingUp,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { ToolsModal, MCPServer } from "@/components/ToolsModal"
import { useTheme } from "@/context/ThemeContext"

// API response types based on actions.ts
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
}

interface APITool {
  id: string;
  serverId: string;
  name: string;
  description: string;
  isMonetized: boolean;
  payment: Record<string, unknown> | null;
  createdAt: string;
}

// Transform API data to frontend format
const transformServerData = (apiServer: APIServer, tools: APITool[] = []): MCPServer => {
  return {
    id: apiServer.serverId,
    name: apiServer.name || 'Unknown Server',
    description: apiServer.description || 'No description available',
    url: `${apiServer.receiverAddress}`, // Using receiverAddress as URL for now
    category: (apiServer.metadata as Record<string, unknown>)?.category as string || 'General',
    icon: <TrendingUp className="h-6 w-6" />,
    verified: apiServer.status === 'active',
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: "object",
        properties: {},
      },
      annotations: {
        title: tool.name,
        readOnlyHint: !tool.isMonetized,
        destructiveHint: false,
      },
    })),
  };
};

const categories = [
  "All",
  "General",
  "Finance",
  "Automation",
  "Database",
  "Development",
  "Productivity",
  "Utilities",
  "Communication",
  "AI/ML",
]

export default function MCPBrowser() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isDark, toggleTheme } = useTheme()

  // Fetch servers from API
  useEffect(() => {
    const fetchServers = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Fetch servers
        const serversResponse = await fetch('https://api.mcpay.fun/api/servers?limit=50')
        if (!serversResponse.ok) {
          throw new Error(`Failed to fetch servers: ${serversResponse.status}`)
        }
        
        const servers: APIServer[] = await serversResponse.json()
        
        // Fetch tools for each server
        const serversWithTools = await Promise.all(
          servers.map(async (server) => {
            try {
              const toolsResponse = await fetch(`https://api.mcpay.fun/api/servers/${server.serverId}/tools`)
              let tools: APITool[] = []
              
              if (toolsResponse.ok) {
                tools = await toolsResponse.json()
              }
              
              return transformServerData(server, tools)
            } catch (toolError) {
              console.warn(`Failed to fetch tools for server ${server.serverId}:`, toolError)
              return transformServerData(server, [])
            }
          })
        )
        
        setMcpServers(serversWithTools)
      } catch (err) {
        console.error('Error fetching servers:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch servers')
      } finally {
        setLoading(false)
      }
    }

    fetchServers()
  }, [])

  const filteredServers = mcpServers.filter((server) => {
    const matchesSearch =
      server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      server.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === "All" || server.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  // Loading state
  if (loading) {
    return (
      <div
        className={`min-h-screen p-6 transition-colors duration-200 ${
          isDark
            ? "bg-gradient-to-br from-black to-gray-900 text-white"
            : "bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900"
        }`}
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">All MCPs</h1>
            <p className={`text-lg max-w-3xl mx-auto ${isDark ? "text-gray-300" : "text-gray-600"}`}>
              Discover and explore Model Context Protocol servers. Connect AI models to external tools, data sources, and
              environments through standardized interfaces.
            </p>
          </div>
          
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
      <div
        className={`min-h-screen p-6 transition-colors duration-200 ${
          isDark
            ? "bg-gradient-to-br from-black to-gray-900 text-white"
            : "bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900"
        }`}
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">All MCPs</h1>
            <p className={`text-lg max-w-3xl mx-auto ${isDark ? "text-gray-300" : "text-gray-600"}`}>
              Discover and explore Model Context Protocol servers. Connect AI models to external tools, data sources, and
              environments through standardized interfaces.
            </p>
          </div>
          
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertCircle className={`h-12 w-12 mx-auto mb-4 ${isDark ? "text-red-400" : "text-red-500"}`} />
              <h3 className="text-lg font-medium mb-2">Failed to load MCP servers</h3>
              <p className={`mb-4 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                {error}
              </p>
              <Button 
                onClick={() => window.location.reload()}
                className={isDark ? "bg-gray-700 text-white hover:bg-gray-600" : ""}
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`min-h-screen p-6 transition-colors duration-200 ${
        isDark
          ? "bg-gradient-to-br from-black to-gray-900 text-white"
          : "bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900"
      }`}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">All MCPs</h1>
          <p className={`text-lg max-w-3xl mx-auto ${isDark ? "text-gray-300" : "text-gray-600"}`}>
            Discover and explore Model Context Protocol servers. Connect AI models to external tools, data sources, and
            environments through standardized interfaces.
          </p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search
              className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${isDark ? "text-gray-400" : "text-gray-400"}`}
            />
            <Input
              placeholder="Search MCP servers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`pl-10 ${isDark ? "bg-gray-800 border-gray-700 text-white placeholder:text-gray-400" : ""}`}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                onClick={() => setSelectedCategory(category)}
                size="sm"
                className={
                  isDark
                    ? selectedCategory === category
                      ? "bg-gray-700 text-white border-gray-600 hover:bg-gray-600"
                      : "bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
                    : selectedCategory === category
                      ? "bg-gray-900 text-white hover:bg-gray-800"
                      : ""
                }
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServers.map((server) => (
            <Card
              key={server.id}
              className={`hover:shadow-lg transition-all duration-200 ${
                isDark ? "bg-gray-800 border-gray-700 text-white hover:shadow-black/50" : ""
              }`}
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-100"}`}>{server.icon}</div>
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {server.name}
                        {server.verified && (
                          <Badge variant="secondary" className={`text-xs ${isDark ? "bg-gray-600 text-gray-200" : ""}`}>
                            Verified
                          </Badge>
                        )}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className={`text-xs mt-1 ${isDark ? "border-gray-500 text-gray-300" : ""}`}
                      >
                        {server.category}
                      </Badge>
                    </div>
                  </div>
                </div>
                <CardDescription className={`text-sm leading-relaxed ${isDark ? "text-gray-300" : ""}`}>
                  {server.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* URL */}
                <div className="space-y-2">
                  <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>MCP URL</label>
                  <div className="flex items-center gap-2">
                    <code
                      className={`flex-1 text-xs p-2 rounded border font-mono break-all ${
                        isDark ? "bg-gray-700 border-gray-600 text-gray-300" : "bg-gray-100 border-gray-200"
                      }`}
                    >
                      {`https://api.mcpay.fun/mcp/${server.id}`}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(`https://api.mcpay.fun/mcp/${server.id}`)}
                      className={`shrink-0 ${isDark ? "bg-gray-700 border-gray-600 text-white hover:bg-gray-600" : ""}`}
                    >
                      Copy
                    </Button>
                  </div>
                </div>

                {/* Tools */}
                <div className="space-y-2">
                  <label
                    className={`text-sm font-medium flex items-center gap-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}
                  >
                    <Tool className="h-4 w-4" />
                    Available Tools ({server.tools.length})
                  </label>
                  <ToolsModal server={server} />
                </div>

                {/* Quick Actions */}
                {/* <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className={`flex-1 ${isDark ? "bg-gray-700 border-gray-600 text-white hover:bg-gray-600" : ""}`}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Analytics
                  </Button>
                </div> */}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredServers.length === 0 && !loading && !error && (
          <div className="text-center py-12">
            <Globe className={`h-12 w-12 mx-auto mb-4 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
            <h3 className="text-lg font-medium mb-2">No MCP servers found</h3>
            <p className={isDark ? "text-gray-400" : "text-gray-600"}>
              {mcpServers.length === 0 
                ? "No servers are currently registered." 
                : "Try adjusting your search terms or category filter."
              }
            </p>
          </div>
        )}

        {/* Footer */}
        <div className={`mt-12 text-center text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
          <div className="flex items-center justify-center gap-4 mb-4">
            <p>
              Learn more about Model Context Protocol at{" "}
              <a
                href="https://modelcontextprotocol.io"
                className={`hover:underline ${isDark ? "text-gray-300" : "text-gray-600"}`}
              >
                modelcontextprotocol.io
              </a>
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className={`flex items-center gap-2 ${isDark ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"}`}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {isDark ? "Light" : "Dark"} Mode
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
