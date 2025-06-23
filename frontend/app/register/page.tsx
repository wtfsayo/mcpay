"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textArea"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Server, Globe, CheckCircle, Loader2, Wallet, RefreshCw, AlertCircle, Lock, Info, ExternalLink, BookOpen } from "lucide-react"
import { useAccount, useConnect, useDisconnect } from "wagmi"
import { api } from "@/lib/utils"
import { useTheme } from "@/context/ThemeContext"
import { ConnectButton } from "@/components/connect-button"
import { openBlockscout } from "@/lib/blockscout"
import { useRouter } from "next/navigation"
import { type Network, getTokensByNetwork, getStablecoins, NETWORKS, type NetworkInfo } from "@/lib/tokens"
import { switchToNetwork, getConnectionStatus } from "@/lib/wallet-utils"

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
  const { isDark } = useTheme()
  const router = useRouter()
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    url: "",
    headers: "",
  })

  const [tools, setTools] = useState<MCPTool[]>([])
  const [isLoadingTools, setIsLoadingTools] = useState(false)
  const [toolsError, setToolsError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [showAuthHeaders, setShowAuthHeaders] = useState(false)
  const [selectedNetwork, setSelectedNetwork] = useState<Network>('base-sepolia')
  const [selectedPaymentToken, setSelectedPaymentToken] = useState<string>('')
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false)

  const { address: walletAddress, isConnected: isWalletConnected } = useAccount()
  const { error: connectError } = useConnect()
  const { disconnect, isPending: isDisconnectingWallet } = useDisconnect()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!walletAddress) {
      setSubmitError("Please connect your wallet first")
      return
    }

    setIsSubmitting(true)
    setSubmitError("")

    try {
      // Parse authentication headers if provided
      let authHeaders: Record<string, unknown> | undefined
      if (showAuthHeaders && formData.headers.trim()) {
        authHeaders = {}
        const lines = formData.headers.split('\n')
        for (const line of lines) {
          const trimmedLine = line.trim()
          if (trimmedLine && trimmedLine.includes(':')) {
            const [key, ...valueParts] = trimmedLine.split(':')
            const value = valueParts.join(':').trim()
            if (key && value) {
              authHeaders[key.trim()] = value
            }
          }
        }
      }

      // Get the selected payment token address - use predefined mapping for simplicity
      const defaultPaymentTokens: Record<Network, string> = {
        'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC on Base Sepolia
        'base': '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC on Base
        'sei-testnet': '0xeAcd10aaA6f362a94823df6BBC3C536841870772', // USDC on Sei Testnet
        'ethereum': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC on Ethereum
        'arbitrum': '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // USDC on Arbitrum
        'optimism': '0x0b2c639c533813f4aa9d7837caf62653d097ff85', // USDC on Optimism
        'polygon': '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', // USDC on Polygon
      }
      
      const paymentTokenAddress = selectedPaymentToken || defaultPaymentTokens[selectedNetwork] || 
        '0x0000000000000000000000000000000000000000' // fallback to native token

      // Prepare tools data with payment information
      const toolsWithPayment = tools
        .filter(tool => tool.price && parseFloat(tool.price) > 0)
        .map(tool => ({
          name: tool.name,
          payment: {
            maxAmountRequired: parseFloat(tool.price || "0"),
            asset: paymentTokenAddress,
            network: selectedNetwork,
            resource: `tool://${tool.name}`,
            description: `Payment for ${tool.name} tool usage`,
            payTo: walletAddress,
          }
        }))

      // Prepare API request payload
      const payload = {
        mcpOrigin: formData.url,
        receiverAddress: walletAddress,
        name: formData.name,
        description: formData.description,
        requireAuth: showAuthHeaders && authHeaders && Object.keys(authHeaders).length > 0,
        ...(authHeaders && Object.keys(authHeaders).length > 0 && { authHeaders }),
        ...(toolsWithPayment.length > 0 && { tools: toolsWithPayment }),
        metadata: {
          registeredFromUI: true,
          timestamp: new Date().toISOString(),
          toolsCount: tools.length,
          monetizedToolsCount: toolsWithPayment.length
        }
      }

      console.log("Submitting server registration:", payload)

      // Make API call to register the server
      const result = await api.registerServer(payload)
      console.log("Server registration successful:", result)

      // Encode the registration result and redirect to success page
      const encodedData = encodeURIComponent(JSON.stringify(result))
      router.push(`/register/success?data=${encodedData}`)

    } catch (error) {
      console.error("Server registration failed:", error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setSubmitError(`Registration failed: ${errorMessage}`)
    } finally {
      setIsSubmitting(false)
    }
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
      const fetchedTools: MCPTool[] = await api.getMcpTools(url)

      if (!Array.isArray(fetchedTools)) {
        console.error("Fetched data is not an array:", fetchedTools)
        throw new Error("Invalid data format received from server.")
      }
      
      // Set default price for all tools
      const toolsWithDefaultPrice = fetchedTools.map(tool => ({
        ...tool,
        price: tool.price || "0.10"
      }))
      setTools(toolsWithDefaultPrice)

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

  const handleDisconnectWallet = () => {
    disconnect()
  }

  const updateToolPrice = (toolName: string, price: string) => {
    setTools(tools.map((tool) => (tool.name === toolName ? { ...tool, price } : tool)))
  }

  const handleNetworkChange = async (network: Network) => {
    setSelectedNetwork(network)
    setSelectedPaymentToken('') // Reset payment token selection
  }

  const handleSwitchToSelectedNetwork = async () => {
    setIsSwitchingNetwork(true)
    try {
      await switchToNetwork(selectedNetwork)
    } catch (error) {
      console.error('Failed to switch network:', error)
      setToolsError(`Failed to switch to ${NETWORKS[selectedNetwork].name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSwitchingNetwork(false)
    }
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

  return (
    <div className="min-h-screen p-6 md:p-8 lg:p-12">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Registration Form */}
        <Card className={`${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} shadow-lg`}>
          <CardHeader className="px-6 md:px-8 pt-8 pb-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className={`flex items-center gap-3 text-xl ${isDark ? "text-white" : "text-gray-900"}`}>
                  <Server className="h-6 w-6" />
                  Server Configuration
                </CardTitle>
                <CardDescription className={`text-base mt-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  Connect your wallet and enter your MCP server URL to automatically detect tools.
                </CardDescription>
              </div>
              
              {/* Getting Started Guide Modal */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className={`px-4 py-2 ${isDark ? "border-gray-600 text-gray-400 hover:text-white hover:bg-gray-700" : "border-gray-300 text-gray-600 hover:text-gray-900 hover:bg-gray-50"}`}
                  >
                    <BookOpen className="h-4 w-4 mr-2" />
                    Getting Started
                  </Button>
                </DialogTrigger>
                <DialogContent className={`max-w-4xl max-h-[90vh] overflow-y-auto ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
                  <DialogHeader>
                    <DialogTitle className={`flex items-center gap-3 text-2xl ${isDark ? "text-white" : "text-gray-900"}`}>
                      <Info className="h-6 w-6 text-blue-500" />
                      Getting Started Guide
                    </DialogTitle>
                    <p className={`text-base mt-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                      Everything you need to know about MCP server registration
                    </p>
                  </DialogHeader>
                  
                  <div className="space-y-6 mt-6">
                    {/* Quick Start Section */}
                    <div className={`rounded-xl p-6 border-l-4 border-blue-500 ${isDark ? "bg-blue-500/5 bg-gradient-to-r from-blue-500/10 to-transparent" : "bg-gradient-to-r from-blue-50 to-blue-25"}`}>
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-lg ${isDark ? "bg-blue-500/20" : "bg-blue-100"} mt-0.5`}>
                          <Server className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <h5 className={`font-semibold mb-3 text-lg ${isDark ? "text-blue-200" : "text-blue-900"}`}>Need to build an MCP server?</h5>
                          <p className={`text-sm leading-relaxed ${isDark ? "text-blue-200" : "text-blue-800"}`}>
                            Try{" "}
                            <a 
                              href="https://github.com/punkpeye/fastmcp" 
                              className={`font-semibold underline decoration-2 underline-offset-2 transition-colors ${isDark ? "hover:text-blue-100" : "hover:text-blue-900"}`}
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              fastmcp
                            </a>
                            {" "}to create a compliant server quickly with minimal configuration.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Requirements Section */}
                    <div className={`rounded-xl p-6 border-l-4 border-amber-500 ${isDark ? "bg-amber-500/5 bg-gradient-to-r from-amber-500/10 to-transparent" : "bg-gradient-to-r from-amber-50 to-amber-25"}`}>
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-lg ${isDark ? "bg-amber-500/20" : "bg-amber-100"} mt-0.5`}>
                          <AlertCircle className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <h5 className={`font-semibold mb-3 text-lg ${isDark ? "text-amber-200" : "text-amber-900"}`}>Technical Requirements</h5>
                          <p className={`text-sm leading-relaxed ${isDark ? "text-amber-200" : "text-amber-800"}`}>
                            MCP servers must implement the{" "}
                            <a 
                              href="https://modelcontextprotocol.io/specification/draft/basic/transports#streamable-http" 
                              className={`font-semibold underline decoration-2 underline-offset-2 transition-colors ${isDark ? "hover:text-amber-100" : "hover:text-amber-900"}`}
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              Streamable HTTP transport
                            </a>
                            {" "}as defined in the MCP specification.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* How it Works Section */}
                    <div className={`rounded-xl border p-6 ${isDark ? "border-gray-600 bg-gradient-to-br from-gray-800/50 to-gray-800/20" : "border-gray-200 bg-gradient-to-br from-gray-50 to-white"}`}>
                      <div className="flex items-center gap-4 mb-6">
                        <div className={`p-3 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-100"}`}>
                          <CheckCircle className="h-6 w-6 text-green-600" />
                        </div>
                        <h4 className={`font-semibold text-xl ${isDark ? "text-white" : "text-gray-900"}`}>How it works</h4>
                      </div>
                      <div className="grid gap-4">
                        {[
                          "Connect your wallet for payment processing",
                          "Enter your MCP server URL to auto-detect available tools", 
                          "Enable authentication if your server requires it",
                          "Set individual pricing for each tool",
                          "Server details are auto-filled from tool inspection",
                          "Your MCP server must use the Streamable HTTP transport"
                        ].map((step, index) => (
                          <div key={index} className="flex items-start gap-4 group p-3 rounded-lg transition-colors hover:bg-opacity-50">
                            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold mt-0.5 transition-colors ${isDark ? "bg-blue-500/20 text-blue-400 group-hover:bg-blue-500/30" : "bg-blue-100 text-blue-600 group-hover:bg-blue-200"}`}>
                              {index + 1}
                            </div>
                            <p className={`text-sm leading-relaxed ${isDark ? "text-gray-300" : "text-gray-600"} group-hover:${isDark ? "text-gray-200" : "text-gray-700"} transition-colors`}>
                              {step}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="px-6 md:px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Wallet Connection - Moved to top */}
              <div className="space-y-4">
                <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  Payment Wallet *
                </label>

                {/* Connect Wallet Button */}
                {!isWalletConnected && (
                  <ConnectButton />
                )}

                {/* Wallet Address Display */}
                {isWalletConnected && walletAddress && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Wallet className={`h-5 w-5 ${isDark ? "text-green-400" : "text-green-600"}`} />
                        <span className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>Connected Wallet</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleDisconnectWallet}
                        disabled={isDisconnectingWallet}
                        className={`px-4 py-2 ${isDark ? "text-gray-400 hover:text-white hover:bg-gray-700" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"}`}
                      >
                        {isDisconnectingWallet ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        Disconnect
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        value={walletAddress}
                        readOnly
                        className={`flex-1 font-mono text-sm h-12 ${isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300 text-gray-900"}`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openBlockscout(walletAddress)}
                        className={`px-3 h-12 ${isDark ? "border-gray-600 text-gray-400 hover:text-white hover:bg-gray-700" : "border-gray-300 text-gray-600 hover:text-gray-900 hover:bg-gray-100"}`}
                        title="View on Blockscout"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  Connect your wallet to receive payments from tool usage
                </p>
              </div>

              {/* Payment Network Selection */}
              <div className="space-y-4">
                <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  Payment Network *
                </label>

                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(NETWORKS).map(([networkKey, networkInfo]) => (
                    <Button
                      key={networkKey}
                      type="button"
                      variant={selectedNetwork === networkKey ? "default" : "outline"}
                      onClick={() => handleNetworkChange(networkKey as Network)}
                      className={`h-auto p-4 justify-start ${selectedNetwork === networkKey 
                        ? isDark ? "bg-gray-700 text-white border-gray-500" : "bg-gray-900 text-white border-gray-900"
                        : isDark ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className={`w-2 h-2 rounded-full ${
                          networkInfo.isTestnet 
                            ? "bg-orange-500" 
                            : "bg-green-500"
                        }`} />
                        <div className="text-left">
                          <div className="font-medium text-sm">{networkInfo.name}</div>
                          <div className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                            {networkInfo.isTestnet ? "Testnet" : "Mainnet"}
                          </div>
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>

                {/* Network Switch Button */}
                {isWalletConnected && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSwitchToSelectedNetwork}
                      disabled={isSwitchingNetwork}
                      className={`px-4 py-2 ${isDark ? "border-gray-600 text-gray-400 hover:text-white hover:bg-gray-700" : "border-gray-300 text-gray-600 hover:text-gray-900 hover:bg-gray-100"}`}
                    >
                      {isSwitchingNetwork ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Switch to {NETWORKS[selectedNetwork].name}
                    </Button>
                    <span className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                      Ensure your wallet is on the correct network
                    </span>
                  </div>
                )}

                <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  Select the blockchain network where you want to receive payments
                </p>
              </div>

              {/* Server URL */}
              <div className="space-y-3">
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
                    className={`h-12 text-base ${isDark ? "bg-gray-700 border-gray-600 text-white placeholder:text-gray-400" : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"}`}
                  />
                  {isLoadingTools && (
                    <Loader2
                      className={`absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 animate-spin ${isDark ? "text-gray-400" : "text-gray-500"}`}
                    />
                  )}
                </div>
                {toolsError && (
                  <div className={`flex items-center gap-3 text-red-500 text-sm p-3 rounded-lg ${isDark ? "bg-red-900/20" : "bg-red-50"}`}>
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{toolsError}</span>
                  </div>
                )}
              </div>

              {/* Authentication Headers Toggle */}
              <div className="flex items-center space-x-3 p-4 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
                <Checkbox
                  id="auth-headers"
                  checked={showAuthHeaders}
                  onCheckedChange={(checked) => setShowAuthHeaders(checked === true)}
                  className={`w-5 h-5 ${isDark ? "border-gray-500 data-[state=checked]:bg-gray-600" : "border-gray-300 data-[state=checked]:bg-gray-900"}`}
                />
                <label
                  htmlFor="auth-headers"
                  className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}
                >
                  <Lock className="h-4 w-4" />
                  Enable Authentication Headers
                </label>
              </div>

              {/* Headers - Only shown when toggle is enabled */}
              {showAuthHeaders && (
                <div className="space-y-3">
                  <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    Authentication Headers
                  </label>
                  <Textarea
                    placeholder="Authorization: Bearer your-token&#10;X-API-Key: your-api-key"
                    value={formData.headers}
                    onChange={(e) => handleInputChange("headers", e.target.value)}
                    rows={3}
                    className={`text-base ${isDark ? "bg-gray-700 border-gray-600 text-white placeholder:text-gray-400" : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"}`}
                  />
                  <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    Add required headers for server authentication (one per line)
                  </p>
                </div>
              )}

              {/* Auto-filled Server Details */}
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    Server Name *
                  </label>
                  <Input
                    placeholder="Auto-detected from server"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    required
                    className={`h-12 text-base ${isDark ? "bg-gray-700 border-gray-600 text-white placeholder:text-gray-400" : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"} ${!tools.length ? "opacity-50" : ""}`}
                    disabled={!tools.length}
                  />
                </div>

                <div className="space-y-3">
                  <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    Description *
                  </label>
                  <Textarea
                    placeholder="Auto-generated from detected tools"
                    value={formData.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    required
                    rows={3}
                    className={`text-base ${isDark ? "bg-gray-700 border-gray-600 text-white placeholder:text-gray-400" : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"} ${!tools.length ? "opacity-50" : ""}`}
                    disabled={!tools.length}
                  />
                </div>
              </div>

              {/* Auto-detected Tools */}
              {tools.length > 0 && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                      Detected Tools ({tools.length})
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => fetchMCPTools(formData.url)}
                      className={`px-4 py-2 ${isDark ? "text-gray-400 hover:text-white hover:bg-gray-700" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"}`}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                  </div>

                  <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                    {tools.map((tool) => (
                      <Card
                        key={tool.name}
                        className={`${isDark ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"} transition-all hover:shadow-md`}
                      >
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h4 className={`font-medium text-base ${isDark ? "text-gray-200" : "text-gray-800"} mb-2`}>
                                {tool.name}
                              </h4>
                              <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"} leading-relaxed`}>
                                {tool.description}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-sm font-medium ${isDark ? "text-gray-400" : "text-gray-600"}`}>$</span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={tool.price || "0.10"}
                                onChange={(e) => updateToolPrice(tool.name, e.target.value)}
                                className={`w-24 text-sm h-10 ${isDark ? "bg-gray-600 border-gray-500 text-white" : "bg-white border-gray-300 text-gray-900"}`}
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
                className={`w-full h-14 text-base font-medium ${
                  isDark ? "bg-gray-700 text-white hover:bg-gray-600" : "bg-gray-900 text-white hover:bg-gray-800"
                } transition-colors duration-200`}
                disabled={!isFormValid || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                    Registering Server...
                  </>
                ) : (
                  <>
                    <Globe className="h-5 w-5 mr-3" />
                    Register MCP Server
                  </>
                )}
              </Button>

              {/* Submit Error Display */}
              {submitError && (
                <div className={`flex items-start gap-3 text-red-500 text-sm p-4 rounded-lg ${isDark ? "bg-red-900/20" : "bg-red-50"}`}>
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{submitError}</span>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
