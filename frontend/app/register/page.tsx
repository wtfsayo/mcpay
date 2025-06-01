"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textArea"
import { Checkbox } from "@/components/ui/checkbox"
import { Server, Globe, CheckCircle, Loader2, Wallet, RefreshCw, AlertCircle, Lock } from "lucide-react"
import { useAccount, useConnect, useDisconnect } from "wagmi"

interface MCPTool {
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

// Helper function to extract a display name from a URL
const generateDisplayNameFromUrl = (urlStr: string): string => {
  try {
    const url = new URL(urlStr)
    let path = url.pathname
    if (path.startsWith("/")) path = path.substring(1)
    if (path.endsWith("/")) path = path.substring(0, path.length - 1)
    
    // Replace common repository hosting prefixes or suffixes if any
    path = path.replace(/^github\.com\//i, '').replace(/^gitlab\.com\//i, '').replace(/^bitbucket\.org\//i, '')
    path = path.replace(/\.git$/i, '')

    if (!path && url.hostname) { // If path is empty, use hostname
        path = url.hostname;
    }
    
    return path
      .split(/[\/\-_]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || "Unknown Source"
  } catch {
    return "Unknown Source"
  }
}

export default function RegisterPage() {
  // Dark mode state - you can replace this with your theme provider logic
  const [isDark, setIsDark] = useState(false)
  
  // Check for system dark mode preference on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      setIsDark(mediaQuery.matches)
      
      const handleChange = (e: MediaQueryListEvent) => setIsDark(e.matches)
      mediaQuery.addEventListener('change', handleChange)
      
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    url: "",
    headers: "",
  })

  const [tools, setTools] = useState<MCPTool[]>([])
  const [isLoadingTools, setIsLoadingTools] = useState(false)
  const [toolsError, setToolsError] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [showAuthHeaders, setShowAuthHeaders] = useState(false)

  const { address: walletAddress, isConnected: isWalletConnected, isConnecting: isAccountConnecting } = useAccount()
  const { connect, connectors, isPending: isConnectingWallet, error: connectError } = useConnect()
  const { disconnect, isPending: isDisconnectingWallet } = useDisconnect()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const submissionData = {
      ...formData,
      walletAddress,
      tools: tools.map((tool) => ({
        ...tool,
        price: tool.price || "0.10", // Default price if not set
      })),
    }

    console.log("Submitting MCP server:", submissionData)
    setIsSubmitted(true)

    // Reset form after 3 seconds
    setTimeout(() => {
      setIsSubmitted(false)
      setFormData({
        name: "",
        description: "",
        url: "",
        headers: "",
      })
      setTools([])
      setToolsError("")
      setShowAuthHeaders(false)
    }, 3000)
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const fetchMCPTools = async (url: string) => {
    if (!url.trim()) {
      setTools([])
      setToolsError("")
      return
    }

    setIsLoadingTools(true)
    setToolsError("")

    try {
      const apiUrl = `https://api.mcpay.fun/api/inspect-mcp-tools?url=${encodeURIComponent(url)}`
      const response = await fetch(apiUrl)

      if (!response.ok) {
        let errorDetails = ""
        try {
          const errorData = await response.json()
          errorDetails = errorData.message || JSON.stringify(errorData)
        } catch (e) {
          // Failed to parse error JSON
          errorDetails = response.statusText
        }
        throw new Error(`HTTP error! status: ${response.status} - ${errorDetails}`)
      }

      const fetchedTools: MCPTool[] = await response.json()

      if (!Array.isArray(fetchedTools)) {
        console.error("Fetched data is not an array:", fetchedTools)
        throw new Error("Invalid data format received from server.")
      }
      
      // Tools are fetched without price; UI will default it or user can set it.
      setTools(fetchedTools)

      // Auto-fill server name and description if not already set by user
      // and if tools were successfully fetched.
      if (fetchedTools.length > 0) {
        const displayName = generateDisplayNameFromUrl(url)
        
        if (!formData.name) {
          handleInputChange("name", `${displayName} MCP Server`)
        }
        if (!formData.description) {
          const toolNames = fetchedTools.map(t => t.name).slice(0, 3).join(", ")
          const toolCount = fetchedTools.length
          let description = `MCP Server for ${displayName}, providing ${toolCount} tool${toolCount > 1 ? 's' : ''}.`
          if (toolCount > 0) {
            description += ` Includes: ${toolNames}${toolCount > 3 ? ' and more' : ''}.`
          }
          handleInputChange("description", description)
        }
      }
    } catch (error) {
      console.error("Failed to fetch MCP tools:", error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      setToolsError(`Failed to fetch tools: ${errorMessage}. Please check the URL and try again.`)
      setTools([])
    } finally {
      setIsLoadingTools(false)
    }
  }

  const handleConnectWallet = () => {
    // Attempt to connect with the first available connector (likely Porto from config)
    if (connectors.length > 0) {
      const connectorToUse = connectors.find(c => c.name === 'Porto') || connectors.find(c => c.name === 'MetaMask') || connectors[0];
      if (connectorToUse) {
        connect({ connector: connectorToUse })
      } else {
        console.error("No suitable connector found.")
        // Optionally, set an error message for the user here
      }
    } else {
      console.error("No connectors available.")
      // Optionally, set an error message for the user here
    }
  }

  const handleDisconnectWallet = () => {
    disconnect()
  }

  const updateToolPrice = (toolName: string, price: string) => {
    setTools(tools.map((tool) => (tool.name === toolName ? { ...tool, price } : tool)))
  }

  // Debounced URL checking
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.url) {
        fetchMCPTools(formData.url)
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [formData.url])

  // Update toolsError display if Wagmi connectError exists
  useEffect(() => {
    if (connectError) {
      setToolsError(`Wallet Connection Error: ${connectError.message}`);
    }
  }, [connectError]);

  const isFormValid = formData.name && formData.description && formData.url && isWalletConnected && tools.length > 0

  if (isSubmitted) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className={`${isDark ? "bg-gray-800 border-gray-700" : ""}`}>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <CheckCircle className={`h-16 w-16 mx-auto ${isDark ? "text-green-400" : "text-green-600"}`} />
              <h3 className="text-xl font-semibold">MCP Server Registered!</h3>
              <p className={`${isDark ? "text-gray-300" : "text-gray-600"}`}>
                Your server with {tools.length} tools has been registered successfully. Payment processing is now active
                for your wallet address.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <Server className={`h-8 w-8 ${isDark ? "text-gray-300" : "text-gray-600"}`} />
          <h2 className="text-3xl font-bold">Register MCP Server</h2>
        </div>
        <p className={`text-lg ${isDark ? "text-gray-300" : "text-gray-600"}`}>
          Connect your MCP server and automatically configure tools for monetization
        </p>
      </div>

      {/* Registration Form */}
      <Card className={`${isDark ? "bg-gray-800 border-gray-700" : ""}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Server Configuration
          </CardTitle>
          <CardDescription className={isDark ? "text-gray-400" : ""}>
            Connect your wallet and enter your MCP server URL to automatically detect tools.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Wallet Connection - Moved to top */}
            <div className="space-y-3">
              <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Payment Wallet *
              </label>

              {/* Connect Wallet Button */}
              {!isWalletConnected && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleConnectWallet}
                  disabled={isConnectingWallet || isAccountConnecting}
                  className={`w-full ${isDark ? "bg-gray-700 border-gray-600 text-white hover:bg-gray-600" : ""}`}
                >
                  {isConnectingWallet || isAccountConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Wallet className="h-4 w-4 mr-2" />
                      Connect Wallet
                    </>
                  )}
                </Button>
              )}

              {/* Wallet Address Display */}
              {isWalletConnected && walletAddress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet className={`h-4 w-4 ${isDark ? "text-green-400" : "text-green-600"}`} />
                      <span className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>Connected Wallet</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleDisconnectWallet}
                      disabled={isDisconnectingWallet}
                      className={isDark ? "text-gray-400 hover:text-white" : ""}
                    >
                      {isDisconnectingWallet ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : null}
                      Disconnect
                    </Button>
                  </div>

                  <Input
                    value={walletAddress}
                    readOnly
                    className={`font-mono text-sm ${isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50"}`}
                  />
                </div>
              )}

              <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                Connect your wallet to receive payments from tool usage
              </p>
            </div>

            {/* Server URL */}
            <div className="space-y-2">
              <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                MCP Server URL *
              </label>
              <div className="relative">
                <Input
                  placeholder="https://your-server.com/mcp/•••••••/sse"
                  value={formData.url}
                  onChange={(e) => handleInputChange("url", e.target.value)}
                  required
                  type="url"
                  className={isDark ? "bg-gray-700 border-gray-600 text-white placeholder:text-gray-400" : ""}
                />
                {isLoadingTools && (
                  <Loader2
                    className={`absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin ${isDark ? "text-gray-400" : "text-gray-500"}`}
                  />
                )}
              </div>
              {toolsError && (
                <div className="flex items-center gap-2 text-red-500 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {toolsError}
                </div>
              )}
            </div>

            {/* Authentication Headers Toggle */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="auth-headers"
                checked={showAuthHeaders}
                onCheckedChange={(checked) => setShowAuthHeaders(checked === true)}
                className={isDark ? "border-gray-500 data-[state=checked]:bg-gray-600" : ""}
              />
              <label
                htmlFor="auth-headers"
                className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}
              >
                <Lock className="h-3.5 w-3.5" />
                Enable Authentication Headers
              </label>
            </div>

            {/* Headers - Only shown when toggle is enabled */}
            {showAuthHeaders && (
              <div className="space-y-2">
                <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  Authentication Headers
                </label>
                <Textarea
                  placeholder="Authorization: Bearer your-token&#10;X-API-Key: your-api-key"
                  value={formData.headers}
                  onChange={(e) => handleInputChange("headers", e.target.value)}
                  rows={2}
                  className={isDark ? "bg-gray-700 border-gray-600 text-white placeholder:text-gray-400" : ""}
                />
                <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  Add required headers for server authentication (one per line)
                </p>
              </div>
            )}

            {/* Auto-filled Server Details */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  Server Name *
                </label>
                <Input
                  placeholder="Auto-detected from server"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  required
                  className={`${isDark ? "bg-gray-700 border-gray-600 text-white placeholder:text-gray-400" : ""} ${!tools.length ? "opacity-50" : ""}`}
                  disabled={!tools.length}
                />
              </div>

              <div className="space-y-2">
                <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  Description *
                </label>
                <Textarea
                  placeholder="Auto-generated from detected tools"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  required
                  rows={3}
                  className={`${isDark ? "bg-gray-700 border-gray-600 text-white placeholder:text-gray-400" : ""} ${!tools.length ? "opacity-50" : ""}`}
                  disabled={!tools.length}
                />
              </div>
            </div>

            {/* Auto-detected Tools */}
            {tools.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    Detected Tools ({tools.length})
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchMCPTools(formData.url)}
                    className={isDark ? "text-gray-400 hover:text-white" : ""}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {tools.map((tool) => (
                    <Card
                      key={tool.name}
                      className={`${isDark ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"}`}
                    >
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className={`font-medium text-sm ${isDark ? "text-gray-200" : "text-gray-800"}`}>
                              {tool.name}
                            </h4>
                            <p className={`text-xs mt-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                              {tool.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>$</span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={tool.price || "0.10"}
                              onChange={(e) => updateToolPrice(tool.name, e.target.value)}
                              className={`w-20 text-xs ${isDark ? "bg-gray-600 border-gray-500 text-white" : ""}`}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className={`w-full ${
                isDark ? "bg-gray-700 text-white hover:bg-gray-600" : "bg-gray-900 text-white hover:bg-gray-800"
              }`}
              disabled={!isFormValid}
            >
              <Globe className="h-4 w-4 mr-2" />
              Register MCP Server
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className={`${isDark ? "bg-gray-800 border-gray-700" : ""}`}>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <h4 className="font-medium">How it works</h4>
            <ul className={`space-y-2 text-sm ${isDark ? "text-gray-300" : "text-gray-600"}`}>
              <li>• Connect your wallet for payment processing</li>
              <li>• Enter your MCP server URL to auto-detect available tools</li>
              <li>• Enable authentication if your server requires it</li>
              <li>• Set individual pricing for each tool</li>
              <li>• Server details are auto-filled from tool inspection</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
