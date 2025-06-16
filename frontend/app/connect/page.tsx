"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textArea"
import { ConnectButton } from "@/components/connect-button"
import { useTheme } from "@/context/ThemeContext"
import { api } from "@/lib/utils"
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Copy,
  Globe,
  Loader2,
  Moon,
  Play,
  Plug,
  Server,
  Shield,
  Sun,
  PenToolIcon as Tool,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
  Zap
} from "lucide-react"
import Image from "next/image"
import { useEffect, useState } from "react"
import { useAccount } from "wagmi"

// Types for API responses
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

interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
  };
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
  };
}

interface MCPServer {
  id: string;
  name: string;
  description: string;
  url: string;
  category: string;
  tools: MCPTool[];
  icon: React.ReactNode;
  verified?: boolean;
}

interface ConnectionState {
  isConnected: boolean;
  server?: MCPServer;
  tools: MCPTool[];
  error?: string;
  isLoading: boolean;
  client?: any; // Store the MCP client for tool calls
}

interface ToolCallResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: Date;
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

// Tool call component for testing individual tools
const ToolCallInterface = ({ 
  tool, 
  onCall 
}: { 
  tool: MCPTool; 
  onCall: (toolName: string, args: any) => Promise<ToolCallResult>;
}) => {
  const [args, setArgs] = useState<Record<string, any>>({});
  const [result, setResult] = useState<ToolCallResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { isDark } = useTheme();

  const handleCall = async () => {
    setIsLoading(true);
    try {
      const callResult = await onCall(tool.name, args);
      setResult(callResult);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      });
    } finally {
      setIsLoading(false);
    }
  };

  const properties = tool.inputSchema.properties || {};

  return (
    <Card className={`${isDark ? "bg-gray-800/60 backdrop-blur border-gray-700" : "bg-white/80 backdrop-blur border-gray-200"} shadow-lg`}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Tool className="h-5 w-5" />
          {tool.name}
          {tool.annotations?.readOnlyHint && (
            <Badge variant="outline" className="text-xs">Free</Badge>
          )}
          {!tool.annotations?.readOnlyHint && (
            <Badge variant="secondary" className="text-xs">Paid</Badge>
          )}
        </CardTitle>
        <CardDescription>{tool.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Parameters */}
        {Object.keys(properties).length > 0 && (
          <div className="space-y-3">
            <label className="text-sm font-medium">Parameters</label>
            {Object.entries(properties).map(([key, schema]: [string, any]) => (
              <div key={key} className="space-y-2">
                <label className="text-xs font-medium">{key}</label>
                <Input
                  placeholder={schema.description || `Enter ${key}`}
                  value={args[key] || ''}
                  onChange={(e) => setArgs(prev => ({ ...prev, [key]: e.target.value }))}
                  className={isDark ? "bg-gray-700 border-gray-600" : ""}
                />
              </div>
            ))}
          </div>
        )}

        {/* Call Button */}
        <Button 
          onClick={handleCall}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Calling...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Call Tool
            </>
          )}
        </Button>

        {/* Result Display */}
        {result && (
          <div className={`p-4 rounded-lg ${
            result.success 
              ? isDark ? "bg-green-900/20 border border-green-700" : "bg-green-50 border border-green-200"
              : isDark ? "bg-red-900/20 border border-red-700" : "bg-red-50 border border-red-200"
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {result.success ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm font-medium">
                {result.success ? 'Success' : 'Error'}
              </span>
              <span className="text-xs text-gray-500 ml-auto">
                {result.timestamp.toLocaleTimeString()}
              </span>
            </div>
            <pre className={`text-xs overflow-auto max-h-32 ${
              isDark ? "text-gray-300" : "text-gray-700"
            }`}>
              {result.success 
                ? JSON.stringify(result.data, null, 2)
                : result.error
              }
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function ConnectPage() {
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    tools: [],
    isLoading: false,
    client: undefined
  })
  const [customUrl, setCustomUrl] = useState("")
  const { isDark, toggleTheme } = useTheme()
  const { address, isConnected: isWalletConnected } = useAccount()

  // Fetch available servers
  useEffect(() => {
    const fetchServers = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const servers: APIServer[] = await api.getServers(50, 0)
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

  // Connect to MCP server using PaymentTransport
  const connectToServer = async (server: MCPServer | string) => {
    if (!isWalletConnected || !address) {
      alert('Please connect your wallet first')
      return
    }

    setConnectionState(prev => ({ ...prev, isLoading: true, error: undefined }))

    try {
      const serverUrl = typeof server === 'string' ? server : `https://api.mcpay.fun/mcp/${server.id}`
      
      // Import the PaymentTransport and AI SDK
      const { createPaymentTransport } = await import('mcpay')
      const { experimental_createMCPClient: createMCPClient } = await import('ai')
      
      // Create wallet client for PaymentTransport
      // Using viem's account format that mcpay expects
      const walletClient = {
        address: address as `0x${string}`,
        // The PaymentTransport will handle wallet operations through wagmi's connector
      } as any // The mcpay library will handle the proper wallet client setup

      // Create PaymentTransport
      const transport = createPaymentTransport(
        new URL(serverUrl),
        walletClient,
        {
          maxPaymentValue: BigInt(0.1 * 10 ** 6), // 0.1 USDC max
        }
      )

      // Create MCP client
      const client = await createMCPClient({
        transport,
      })

      // Get tools from the server
      const tools = await client.tools()
      
      if (!tools) {
        throw new Error("No tools found")
      }

      const toolsList = Object.keys(tools).map((toolName): MCPTool => {
        const tool = tools[toolName]
        const parameters = tool?.parameters as any
        const properties = parameters?.properties || {}
        
        return {
          name: toolName,
          description: tool?.description,
          inputSchema: {
            type: "object",
            properties: properties
          },
          annotations: {
            title: toolName,
            readOnlyHint: false, // All tools through PaymentTransport can be paid
            destructiveHint: false,
          },
        }
      })

      setConnectionState({
        isConnected: true,
        server: typeof server === 'string' ? undefined : server,
        tools: toolsList,
        isLoading: false,
        client: client // Store the client for tool calls
      })

    } catch (err) {
      console.error('Connection error:', err)
      setConnectionState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to connect to server'
      }))
    }
  }

  // Handle tool calls
  const handleToolCall = async (toolName: string, args: any): Promise<ToolCallResult> => {
    try {
      if (!connectionState.client) {
        throw new Error("No client connected")
      }

      console.log(`Calling tool ${toolName} with args:`, args)
      
      // Use the connected MCP client to make the actual call
      const result = await connectionState.client.callTool({
        name: toolName,
        arguments: args
      })
      
      return {
        success: true,
        data: result,
        timestamp: new Date()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      }
    }
  }

  // Disconnect from server
  const disconnectFromServer = () => {
    setConnectionState({
      isConnected: false,
      tools: [],
      isLoading: false,
      client: undefined
    })
  }

  if (error) {
    return (
      <div className={`min-h-screen ${isDark ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" : "bg-gradient-to-br from-gray-50 via-white to-gray-100"}`}>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="p-4 rounded-full bg-red-100 dark:bg-red-900/20 w-fit mx-auto mb-6">
                <AlertCircle className={`h-12 w-12 ${isDark ? "text-red-400" : "text-red-500"}`} />
              </div>
              <h3 className="text-2xl font-bold mb-2">Connection Failed</h3>
              <p className={`mb-6 text-lg ${isDark ? "text-gray-400" : "text-gray-600"}`}>{error}</p>
              <Button onClick={() => window.location.reload()} size="lg" className="bg-gradient-to-r from-blue-500 to-purple-600">
                <Plug className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${isDark ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" : "bg-gradient-to-br from-gray-50 via-white to-gray-100"}`}>
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-40 -right-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob ${isDark ? "bg-purple-500" : "bg-purple-300"}`} />
        <div className={`absolute -bottom-40 -left-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000 ${isDark ? "bg-blue-500" : "bg-blue-300"}`} />
        <div className={`absolute top-40 left-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000 ${isDark ? "bg-pink-500" : "bg-pink-300"}`} />
      </div>

      <div className="relative container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12 relative">
          <div className="flex justify-center mb-6 animate-fade-in-up">
            <Image 
              src="/mcpay-logo.svg" 
              alt="MCPay Logo" 
              width={150} 
              height={150}
              className="drop-shadow-lg"
            />
          </div>
          <h1 className={`text-4xl font-bold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>
            Connect to MCP Servers
          </h1>
          <p className={`text-xl max-w-3xl mx-auto leading-relaxed ${isDark ? "text-gray-300" : "text-gray-600"}`}>
            Connect your wallet and interact with MCP servers using the x402 payment protocol.
          </p>
          
          {/* Wallet Connection Status */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <ConnectButton />
            <Button variant="outline" size="sm" onClick={toggleTheme} className="flex items-center gap-2">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {isDark ? "Light" : "Dark"}
            </Button>
          </div>

          {isWalletConnected && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              <span className={`text-sm ${isDark ? "text-green-400" : "text-green-600"}`}>
                Wallet Connected
              </span>
            </div>
          )}
        </div>

        {/* Connection Status */}
        {connectionState.isConnected && (
          <Card className={`mb-8 ${isDark ? "bg-gray-800/60 backdrop-blur border-gray-700" : "bg-white/80 backdrop-blur border-gray-200"} shadow-lg`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Connected to {connectionState.server?.name || 'MCP Server'}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={disconnectFromServer}
                  className="ml-auto"
                >
                  Disconnect
                </Button>
              </CardTitle>
              <CardDescription>
                {connectionState.tools.length} tools available
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Tools Interface (when connected) */}
        {connectionState.isConnected && connectionState.tools.length > 0 && (
          <div className="mb-12">
            <h2 className={`text-2xl font-bold mb-6 ${isDark ? "text-white" : "text-gray-900"}`}>
              Available Tools
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {connectionState.tools.map((tool, index) => (
                <ToolCallInterface
                  key={`${tool.name}-${index}`}
                  tool={tool}
                  onCall={handleToolCall}
                />
              ))}
            </div>
          </div>
        )}

        {/* Connection Error */}
        {connectionState.error && (
          <Card className={`mb-8 ${isDark ? "bg-red-900/20 border-red-700" : "bg-red-50 border-red-200"} shadow-lg`}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <span className="font-medium">Connection Error</span>
              </div>
              <p className={`mt-2 text-sm ${isDark ? "text-red-400" : "text-red-600"}`}>
                {connectionState.error}
              </p>
            </CardContent>
          </Card>
        )}

        {!connectionState.isConnected && (
          <>
            {/* Custom URL Connection */}
            <Card className={`mb-8 ${isDark ? "bg-gray-800/60 backdrop-blur border-gray-700" : "bg-white/80 backdrop-blur border-gray-200"} shadow-lg`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Connect to Custom Server
                </CardTitle>
                <CardDescription>
                  Enter a custom MCP server URL to connect directly
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="https://api.example.com/mcp"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className={isDark ? "bg-gray-700 border-gray-600" : ""}
                />
                <Button 
                  onClick={() => connectToServer(customUrl)}
                  disabled={!customUrl || !isWalletConnected || connectionState.isLoading}
                  className="w-full"
                >
                  {connectionState.isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Plug className="h-4 w-4 mr-2" />
                      Connect to Server
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Category Filter */}
            <div className="flex justify-center mb-8">
              <div className="flex gap-2 flex-wrap p-2 rounded-2xl bg-white/50 dark:bg-gray-800/50 backdrop-blur shadow-lg border border-white/20 dark:border-gray-700/20">
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "ghost"}
                    onClick={() => setSelectedCategory(category)}
                    size="sm"
                    disabled={loading}
                    className={selectedCategory === category 
                      ? `${isDark ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-600 hover:bg-blue-700"} text-white shadow-lg` 
                      : "hover:bg-white/70 dark:hover:bg-gray-700/70"
                    }
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>

            {/* Server List */}
            <div className="mb-8">
              <h2 className={`text-2xl font-bold mb-6 ${isDark ? "text-white" : "text-gray-900"}`}>
                Available MCP Servers
              </h2>
              
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Card key={index} className={`${isDark ? "bg-gray-800/50 backdrop-blur border-gray-700" : "bg-white/80 backdrop-blur border-gray-200"} shadow-lg`}>
                      <CardHeader>
                        <div className={`h-6 w-3/4 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
                        <div className={`h-4 w-1/2 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
                      </CardHeader>
                      <CardContent>
                        <div className={`h-4 w-full rounded animate-pulse mb-2 ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
                        <div className={`h-4 w-2/3 rounded animate-pulse mb-4 ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
                        <div className={`h-10 w-full rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredServers.map((server, index) => (
                    <Card key={server.id} className={`group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 ${
                      isDark ? "bg-gray-800/60 backdrop-blur" : "bg-white/80 backdrop-blur"
                    }`}>
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                      <CardHeader className="pb-4 relative">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl ${isDark ? "bg-blue-900/20" : "bg-blue-50"} shadow-lg`}>
                            {server.icon}
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-xl mb-2">{server.name}</CardTitle>
                            <Badge variant="outline" className="text-xs">
                              {server.category}
                            </Badge>
                          </div>
                        </div>
                        
                        <CardDescription className="text-sm leading-relaxed mt-4">
                          {server.description}
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Tool className="h-4 w-4" />
                          <span>{server.tools.length} tools available</span>
                        </div>

                        <Button 
                          onClick={() => connectToServer(server)}
                          disabled={!isWalletConnected || connectionState.isLoading}
                          className="w-full"
                        >
                          {connectionState.isLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            <>
                              <Plug className="h-4 w-4 mr-2" />
                              Connect & Use Tools
                              <ArrowRight className="h-4 w-4 ml-2" />
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {!loading && filteredServers.length === 0 && (
                <div className="text-center py-12">
                  <div className="p-6 rounded-2xl bg-gray-100 dark:bg-gray-800 w-fit mx-auto mb-6">
                    <Server className={`h-16 w-16 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
                  </div>
                  <h3 className="text-2xl font-bold mb-4">No Servers Found</h3>
                  <p className={`text-lg ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    Try exploring a different category or register your own server.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className={`text-center py-8 border-t ${isDark ? "border-gray-700" : "border-gray-200"}`}>
          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Powered by the{" "}
            <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
              Model Context Protocol
            </a>{" "}
            and{" "}
            <a href="https://x402.org" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
              x402 payment protocol
            </a>
          </p>
        </div>
      </div>

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out forwards;
        }

        .animate-blob {
          animation: blob 7s infinite;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  )
}
