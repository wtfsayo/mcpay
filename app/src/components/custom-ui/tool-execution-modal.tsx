"use client"

import { ConnectButton } from "@/components/custom-ui/connect-button"
import { useTheme } from "@/components/providers/theme-context"
import { usePrimaryWallet, useUser, useUserWallets } from "@/components/providers/user"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { urlUtils } from "@/lib/client/utils"
import { switchToNetwork } from "@/lib/client/wallet-utils"
import {
  formatTokenAmount,
  getNetworkByChainId,
  getTokenInfo,
} from "@/lib/commons"
import { type Network } from "@/types/blockchain"
import { InputProperty, MCPClient, MCPToolFromClient, MCPToolsCollection, ToolExecutionModalProps, ToolInputSchema, type ToolFromMcpServerWithStats } from "@/types/mcp"
import { type UserWallet } from "@/types/wallet"
import { experimental_createMCPClient } from "ai"
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  Coins,
  Copy,
  Loader2,
  Play,
  RefreshCw,
  Wallet,
  Wrench
} from "lucide-react"
import { createPaymentTransport } from "mcpay/client"
import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useAccount, useChainId, useWalletClient } from "wagmi"
import { getNetworkConfig, getNetworkInfo } from "@/lib/commons/tokens"
import { privateKeyToAccount } from "viem/accounts"

// Helper function to format wallet address for display
const formatWalletAddress = (address: string): string => {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================



type ExecutionStatus = 'idle' | 'initializing' | 'executing' | 'success' | 'error'

interface ToolExecution {
  status: ExecutionStatus
  result?: unknown
  error?: string
}


// =============================================================================
// STYLING UTILITIES
// =============================================================================

const getThemeClasses = (isDark: boolean) => ({
  input: isDark ? "bg-gray-700 border-gray-600 text-white" : "",
  button: isDark ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "",
  modal: isDark ? "bg-gray-800 border-gray-700" : "",
  text: {
    primary: isDark ? "text-gray-300" : "text-gray-700",
    secondary: isDark ? "text-gray-400" : "text-gray-600",
    error: isDark ? "text-gray-300" : "text-gray-800"
  },
  background: {
    error: isDark ? "bg-red-900/20 text-red-400 border border-red-800" : "bg-red-50 text-red-600 border border-red-200",
    success: isDark ? "bg-green-900/20 text-green-400 border-green-800" : "bg-green-50 text-green-600 border-green-200",
    warning: isDark ? "bg-orange-900/20 text-orange-400 border-orange-800" : "bg-orange-50 text-orange-600 border-orange-200",
    info: isDark ? "bg-blue-900/20 text-blue-400 border-blue-800" : "bg-blue-50 text-blue-600 border-blue-200",
    code: isDark ? "bg-gray-800 border-gray-700" : "bg-gray-100 border-gray-200"
  }
})

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ToolExecutionModal({ isOpen, onClose, tool, serverId }: ToolExecutionModalProps) {
  const { isDark } = useTheme()
  const { hasWallets } = useUser()
  const primaryWallet = usePrimaryWallet()
  const userWallets = useUserWallets()
  const { data: walletClient } = useWalletClient()
  const { address: connectedWalletAddress, isConnected: isBrowserWalletConnected } = useAccount()
  const chainId = useChainId()
  const themeClasses = getThemeClasses(isDark)
  
  // State for selected wallet (defaults to primary wallet)
  const [selectedWallet, setSelectedWallet] = useState<UserWallet | null>(null)
  const [showWalletSelection, setShowWalletSelection] = useState(false)

  // Set selected wallet to primary when primary wallet changes
  useEffect(() => {
    if (primaryWallet && !selectedWallet) {
      setSelectedWallet(primaryWallet)
    }
  }, [primaryWallet, selectedWallet])

  // Get wallet connection status
  const activeWallet = selectedWallet || primaryWallet
  const walletAddress = activeWallet?.walletAddress
  const hasAccountWallets = hasWallets() && !!walletAddress
  
  // Check if selected wallet requires browser connection
  const requiresBrowserConnection = activeWallet?.walletType === 'external'
  const hasWalletClient = !!walletClient
  const needsBrowserConnection = requiresBrowserConnection && (!isBrowserWalletConnected || connectedWalletAddress?.toLowerCase() !== walletAddress?.toLowerCase())
  const needsWalletClient = requiresBrowserConnection // Only external wallets need wagmi wallet client
  
  // Overall connection status
  const isConnected = hasAccountWallets && (!needsWalletClient || hasWalletClient) && !needsBrowserConnection
  
  // Create stable tool reference to avoid infinite loops
  const toolInputSchemaString = useMemo(() => JSON.stringify(tool?.inputSchema), [tool?.inputSchema])
  const toolPricingString = useMemo(() => JSON.stringify(tool?.pricing), [tool?.pricing])
  
  const stableTool = useMemo(() => {
    if (!tool) return null
    return tool
  }, [tool, tool?.id, tool?.name, toolInputSchemaString, tool?.description, tool?.isMonetized, toolPricingString])

  // State management
  const [toolInputs, setToolInputs] = useState<Record<string, unknown>>({})
  const [execution, setExecution] = useState<ToolExecution>({ status: 'idle' })
  const [isMobile, setIsMobile] = useState(false)
  const [mcpClient, setMcpClient] = useState<MCPClient | null>(null)
  const [mcpToolsCollection, setMcpToolsCollection] = useState<MCPToolsCollection>({})
  const [isInitialized, setIsInitialized] = useState(false)
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false)

  // =============================================================================
  // NETWORK UTILITIES
  // =============================================================================

  const getRequiredNetwork = useCallback((): string | null => {
    if (!stableTool?.isMonetized || !stableTool.pricing.length) return null
    return stableTool.pricing[0].network
  }, [stableTool])

  const getCurrentNetwork = useCallback((): string | null => {
    const network = chainId ? getNetworkByChainId(chainId) : undefined
    return typeof network === 'string' ? network : null
  }, [chainId])

  const isOnCorrectNetwork = useCallback((): boolean => {
    const requiredNetwork = getRequiredNetwork()
    const currentNetwork = getCurrentNetwork()

    if (!requiredNetwork) return true // Free tools don't require specific network
    return requiredNetwork === currentNetwork
  }, [getRequiredNetwork, getCurrentNetwork])

  const shouldShowNetworkStatus = useCallback((): boolean => {
    if (!tool?.isMonetized || !tool.pricing?.length || !isConnected) {
      return false
    }
    return isOnCorrectNetwork()
  }, [tool, isConnected, isOnCorrectNetwork])

  const handleNetworkSwitch = async () => {
    const requiredNetwork = getRequiredNetwork()
    if (!requiredNetwork) return

    setIsSwitchingNetwork(true)
    setExecution({ status: 'idle' }) // Clear any previous errors

    try {
      console.log(`[Network Switch] Starting switch to ${requiredNetwork}`)
      
      // Get network info from unified system

      const networkInfo = getNetworkInfo(requiredNetwork as Network)
      console.log(`[Network Switch] Network info:`, networkInfo)

      await switchToNetwork(requiredNetwork as Network)
      console.log(`[Network Switch] Successfully switched to ${requiredNetwork}`)

      // Clear any previous errors after successful switch
      if (execution.status === 'error') {
        setExecution({ status: 'idle' })
      }
    } catch (error) {
      console.error('[Network Switch] Failed to switch network:', error)
      console.error('[Network Switch] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        requiredNetwork,
        error
      })

      setExecution({
        status: 'error',
        error: `Failed to switch to ${requiredNetwork}: ${error instanceof Error ? error.message : 'Unknown error. Check browser console for details.'}`
      })
    } finally {
      setIsSwitchingNetwork(false)
    }
  }

  // =============================================================================
  // CURRENCY AND TOKEN UTILITIES
  // =============================================================================

  const formatCurrency = useCallback((amount: string | number, currency: string, network?: string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount

    // If we have network info, try to get token info from registry
    if (network) {
      const tokenInfo = getTokenInfo(currency, network as Network)
      if (tokenInfo) {
        // Use our awesome token registry formatting
        return formatTokenAmount(num, currency, network as Network, {
          showSymbol: true,
          precision: tokenInfo.isStablecoin ? 2 : 4,
          compact: num >= 1000
        })
      }
    }

    // Fallback: check if it's a token address and show abbreviated
    if (currency.startsWith('0x') && currency.length === 42) {
      return `${num.toFixed(6)} ${currency.slice(0, 6)}...${currency.slice(-4)}`
    }

    // Simple currency display
    return `${num.toFixed(6)} ${currency}`
  }, [])

  // Enhanced token display with verification badge
  const TokenDisplay = ({
    currency,
    network,
    amount
  }: {
    currency: string
    network: string
    amount?: string | number
  }) => {
    const tokenInfo = getTokenInfo(currency, network as Network)

    return (
      <div className="flex items-center gap-2">
        {/* Token Logo */}
        {tokenInfo?.logoUri && (
          <div className="w-4 h-4 rounded-full overflow-hidden">
            <Image
              src={tokenInfo.logoUri}
              alt={tokenInfo.symbol}
              width={16}
              height={16}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Amount and Symbol */}
        <div className="flex items-center gap-1">
          {amount && (
            <span className="font-medium">
              {formatCurrency(amount, currency, network)}
            </span>
          )}
          {!amount && tokenInfo && (
            <span className="font-medium">{tokenInfo.symbol}</span>
          )}
          {!amount && !tokenInfo && (
            <span className="font-mono text-xs">
              {currency.startsWith('0x') ? `${currency.slice(0, 6)}...` : currency}
            </span>
          )}
        </div>
      </div>
    )
  }

  // =============================================================================
  // MOBILE DETECTION
  // =============================================================================

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkIsMobile()
    window.addEventListener('resize', checkIsMobile)

    return () => window.removeEventListener('resize', checkIsMobile)
  }, [])

  // =============================================================================
  // TOOL SCHEMA UTILITIES
  // =============================================================================

  const getToolProperties = useCallback((toolArg: ToolFromMcpServerWithStats): Record<string, InputProperty> => {
    // First try to get from MCP client tools (if available and initialized)
    if (isInitialized && mcpToolsCollection[toolArg.name]) {
      const mcpTool = mcpToolsCollection[toolArg.name] as MCPToolFromClient
      if (mcpTool.inputSchema?.jsonSchema?.properties) {
        return mcpTool.inputSchema.jsonSchema.properties
      }
      if (mcpTool.parameters?.jsonSchema?.properties) {
        return mcpTool.parameters.jsonSchema.properties
      }
    }

    // Fallback to server tool inputSchema
    const schema = toolArg.inputSchema as ToolInputSchema
    if (schema && typeof schema === 'object' && schema.properties) {
      return schema.properties
    }
    return {}
  }, [isInitialized, mcpToolsCollection])

  const getRequiredFields = useCallback((toolArg: ToolFromMcpServerWithStats): string[] => {
    // First try to get from MCP client tools (if available and initialized)
    if (isInitialized && mcpToolsCollection[toolArg.name]) {
      const mcpTool = mcpToolsCollection[toolArg.name] as MCPToolFromClient
      if (mcpTool.parameters?.jsonSchema?.required) {
        return mcpTool.parameters.jsonSchema.required
      }
      if (mcpTool.inputSchema?.jsonSchema?.required) {
        return mcpTool.inputSchema.jsonSchema.required
      }
    }

    // Fallback to server tool inputSchema
    const schema = toolArg.inputSchema as ToolInputSchema
    if (schema && typeof schema === 'object' && schema.required) {
      return schema.required
    }
    return []
  }, [isInitialized, mcpToolsCollection])

  const hasToolInputs = useCallback((toolArg: ToolFromMcpServerWithStats): boolean => {
    const properties = getToolProperties(toolArg)
    return Object.keys(properties).length > 0
  }, [getToolProperties])

  // =============================================================================
  // TOOL INPUT MANAGEMENT
  // =============================================================================

  // Track previous tool ID and wallet ID to avoid unnecessary resets
  const [previousToolId, setPreviousToolId] = useState<string | null>(null)
  const [previousWalletId, setPreviousWalletId] = useState<string | null>(null)

  useEffect(() => {
    if (!stableTool) {
      setPreviousToolId(null)
      return
    }

    const currentWalletId = activeWallet?.id || null

    // Reset MCP initialization if the tool or active wallet changed
    const toolChanged = previousToolId !== stableTool.id
    const walletChanged = previousWalletId !== currentWalletId

    if (toolChanged || walletChanged) {
      if (toolChanged) setPreviousToolId(stableTool.id)
      if (walletChanged) setPreviousWalletId(currentWalletId)
      
      setIsInitialized(false)
      setIsSwitchingNetwork(false)
    }

    // Initialize tool inputs (this doesn't depend on MCP being ready)
    const inputs: Record<string, unknown> = {}
    const properties = getToolProperties(stableTool)

    Object.entries(properties).forEach(([key, prop]) => {
      if (prop.type === 'array') {
        inputs[key] = prop.default || []
      } else {
        inputs[key] = prop.default || ''
      }
    })

    setToolInputs(inputs)
    setExecution({ status: 'idle' })
  }, [stableTool, activeWallet?.id, previousToolId, previousWalletId, getToolProperties])

  // Update inputs when MCP data becomes available (enhances the initial inputs)
  useEffect(() => {
    if (!stableTool || !isInitialized || !mcpToolsCollection[stableTool.name]) return

    const inputs: Record<string, unknown> = {}
    const properties = getToolProperties(stableTool)

    Object.entries(properties).forEach(([key, prop]) => {
      if (prop.type === 'array') {
        inputs[key] = prop.default || []
      } else {
        inputs[key] = prop.default || ''
      }
    })

    setToolInputs(inputs)
  }, [stableTool, isInitialized, mcpToolsCollection, getToolProperties])

  // =============================================================================
  // MCP CLIENT INITIALIZATION
  // =============================================================================

  useEffect(() => {
    if (!isOpen || !isConnected || !walletAddress || !stableTool || isInitialized) return
    // Only check for walletClient if it's an external wallet that needs it
    if (needsWalletClient && !walletClient) return

    const initializeMcpClient = async () => {
      try {
        setExecution({ status: 'initializing' })

        // Create the MCP URL using the serverId
        const mcpUrl = new URL(urlUtils.getMcpUrl(serverId))

        // Create a viem-compatible Account object that x402 can use
        let account
        
        if (activeWallet?.walletType === 'external') {
          // For external wallets, use the wagmi wallet client
          if (!walletClient) {
            throw new Error("Wallet client required for external wallets")
          }
          account = walletClient
          console.log("Using external wallet client:", walletClient);
          console.log("Wallet client chain info:", walletClient.chain);
        } else {
          // For managed wallets, create a dummy account for transport initialization
          // The actual payment signing will be intercepted and handled server-side via CDP
          // We use a dummy private key just to create a valid viem account structure
          const dummyPrivateKey = '0x0000000000000000000000000000000000000000000000000000000000000001'
          const dummyAccount = privateKeyToAccount(dummyPrivateKey)
          
          // Override the address to match the managed wallet address
          account = {
            ...dummyAccount,
            address: walletAddress as `0x${string}`,
          }
          
          console.log("Using managed wallet with dummy account (server-side payment):", {
            address: account.address,
            type: 'managed',
            walletType: activeWallet?.walletType
          });
        }

        const transport = createPaymentTransport(new URL(mcpUrl), account, {
          maxPaymentValue: BigInt(0.1 * 10 ** 6), // 0.1 USDC max
          requestInit: {
            // Add headers to help server identify managed wallet requests
            headers: {
              'X-Wallet-Type': activeWallet?.walletType || 'unknown',
              'X-Wallet-Address': walletAddress || '',
              'X-Wallet-Provider': activeWallet?.provider || 'unknown',
            }
          }
        });

        // Create MCP client
        const client = await experimental_createMCPClient({
          transport: transport,
        })

        console.log("MCP client created", client)

        // Get available tools
        const tools = await client.tools()
        console.log("Available MCP tools:", tools)

        setMcpClient(client)
        setMcpToolsCollection(tools)
        setIsInitialized(true)
        setExecution({ status: 'idle' })

        console.log(`MCP client initialized for tool: ${stableTool.name}`)
        console.log(`Available tools: ${Object.keys(tools).join(', ')}`)

        // Check if the current tool is available in MCP
        if (tools[stableTool.name]) {
          console.log(`Current tool found in MCP:`, tools[stableTool.name])
          const mcpTool = tools[stableTool.name] as unknown as MCPToolFromClient
          console.log(`Provider options:`, mcpTool)
          console.log(`Current tool schema:`, mcpTool.inputSchema || mcpTool.parameters)
        } else {
          console.warn(`Warning: Tool "${stableTool.name}" not found in MCP server tools`)
        }
      } catch (error) {
        console.error("Failed to initialize MCP client:", error)
        setExecution({
          status: 'error',
          error: error instanceof Error ? error.message : 'Failed to initialize MCP client'
        })
      }
    }

    initializeMcpClient()
  }, [isOpen, isConnected, walletAddress, stableTool, serverId, walletClient, isInitialized, needsWalletClient, activeWallet])

  // Cleanup when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsInitialized(false)
      setMcpClient(null)
      setMcpToolsCollection({})
      setExecution({ status: 'idle' })
      setIsSwitchingNetwork(false)
      setShowWalletSelection(false)
    }
  }, [isOpen])

  // =============================================================================
  // TOOL EXECUTION
  // =============================================================================

  const updateToolInput = (inputName: string, value: unknown) => {
    setToolInputs(prev => ({
      ...prev,
      [inputName]: value
    }))
  }

  const executeTool = async () => {
    if (!stableTool || !mcpClient || !isInitialized) return
    // For external wallets, ensure wallet client is available
    if (needsWalletClient && !walletClient) return

    setExecution({ status: 'executing' })

    try {
      // Get the MCP tool by name
      const mcpTool = mcpToolsCollection[stableTool.name] as MCPToolFromClient

      if (!mcpTool) {
        throw new Error(`Tool "${stableTool.name}" not found in MCP server`)
      }

      console.log(`[Tool Execution] Starting execution for: ${stableTool.name}`)
      console.log(`[Tool Execution] Wallet type: ${activeWallet?.walletType}`)
      console.log(`[Tool Execution] Wallet address: ${walletAddress}`)
      console.log(`[Tool Execution] Tool inputs:`, toolInputs)
      console.log(`[Tool Execution] MCP tool schema:`, mcpTool.parameters?.jsonSchema || mcpTool.inputSchema?.jsonSchema)

      // Execute the tool using the MCP client's callTool method
      const result = await mcpTool.execute?.(toolInputs, {
        toolCallId: Date.now().toString(),
        messages: []
      })

      console.log(`[Tool Execution] Execution successful:`, result)

      setExecution({
        status: 'success',
        result
      })
    } catch (error) {
      console.error("[Tool Execution] Execution failed:", error)
      
      // Enhanced error handling for managed wallets
      if (activeWallet?.walletType === 'managed' && error instanceof Error) {
        if (error.message.includes('CDP') || error.message.includes('managed')) {
          setExecution({
            status: 'error',
            error: `Managed wallet error: ${error.message}. Please try again or contact support if the issue persists.`
          })
        } else {
          setExecution({
            status: 'error',
            error: `Tool execution failed: ${error.message}`
          })
        }
      } else {
        setExecution({
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        })
      }
    }
  }

  const copyResult = (result: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(result, null, 2))
  }

  // =============================================================================
  // INPUT FIELD RENDERING
  // =============================================================================

  const renderInputField = (inputName: string, inputProp: InputProperty) => {
    console.log("Rendering input field:", inputName, inputProp)
    if (!stableTool) return null

    const currentValue = toolInputs[inputName] || ''
    const requiredFields = getRequiredFields(stableTool)
    const isRequired = requiredFields.includes(inputName)

    // Handle array inputs
    if (inputProp.type === 'array') {
      const arrayValue = Array.isArray(currentValue) ? currentValue : []

      const addArrayItem = () => {
        const newArray = [...arrayValue, '']
        updateToolInput(inputName, newArray)
      }

      const removeArrayItem = (index: number) => {
        const newArray = arrayValue.filter((_: unknown, i: number) => i !== index)
        updateToolInput(inputName, newArray)
      }

      const updateArrayItem = (index: number, value: string) => {
        const newArray = [...arrayValue]
        newArray[index] = value
        updateToolInput(inputName, newArray)
      }

      return (
        <div key={inputName} className="space-y-2">
          <label className={`text-sm font-medium flex items-center gap-1 ${themeClasses.text.primary}`}>
            {inputName}
            {isRequired && <span className="text-red-500">*</span>}
          </label>
          <div className="space-y-2">
            {arrayValue.map((item: unknown, index: number) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="text"
                  value={String(item)}
                  onChange={(e) => updateArrayItem(index, e.target.value)}
                  placeholder={`Enter ${inputName} item ${index + 1}`}
                  className={`flex-1 ${themeClasses.input}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeArrayItem(index)}
                  className={`px-2 ${themeClasses.button}`}
                >
                  ×
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addArrayItem}
              className={`w-full ${themeClasses.button}`}
            >
              + Add {inputName} item
            </Button>
          </div>
          {inputProp.description && (
            <p className={`text-xs ${themeClasses.text.secondary}`}>
              {inputProp.description}
            </p>
          )}
        </div>
      )
    }

    if (inputProp.enum) {
      return (
        <div key={inputName} className="space-y-2">
          <label className={`text-sm font-medium flex items-center gap-1 ${themeClasses.text.primary}`}>
            {inputName}
            {isRequired && <span className="text-red-500">*</span>}
          </label>
          <select
            className={`w-full px-3 py-2 rounded-md border text-sm ${isDark
                ? "bg-gray-700 border-gray-600 text-white"
                : "bg-white border-gray-300 text-gray-900"
              }`}
            value={String(currentValue)}
            onChange={(e) => updateToolInput(inputName, e.target.value)}
          >
            <option value="">Select {inputName}</option>
            {inputProp.enum.map(option => (
              <option key={String(option)} value={String(option)}>{String(option)}</option>
            ))}
          </select>
          {inputProp.description && (
            <p className={`text-xs ${themeClasses.text.secondary}`}>
              {inputProp.description}
            </p>
          )}
        </div>
      )
    }

    if (inputProp.type === 'number' || inputProp.type === 'integer') {
      return (
        <div key={inputName} className="space-y-2">
          <label className={`text-sm font-medium flex items-center gap-1 ${themeClasses.text.primary}`}>
            {inputName}
            {isRequired && <span className="text-red-500">*</span>}
          </label>
          <Input
            type="number"
            value={String(currentValue)}
            onChange={(e) => updateToolInput(inputName, parseFloat(e.target.value) || '')}
            placeholder={`Enter ${inputName}`}
            min={inputProp.minimum}
            max={inputProp.maximum}
            className={themeClasses.input}
          />
          {inputProp.description && (
            <p className={`text-xs ${themeClasses.text.secondary}`}>
              {inputProp.description}
            </p>
          )}
        </div>
      )
    }

    if (inputProp.type === 'boolean') {
      return (
        <div key={inputName} className="space-y-2">
          <label className={`flex items-center gap-2 text-sm font-medium ${themeClasses.text.primary}`}>
            <input
              type="checkbox"
              checked={currentValue === true}
              onChange={(e) => updateToolInput(inputName, e.target.checked)}
              className="rounded"
            />
            {inputName}
            {isRequired && <span className="text-red-500">*</span>}
          </label>
          {inputProp.description && (
            <p className={`text-xs ml-6 ${themeClasses.text.secondary}`}>
              {inputProp.description}
            </p>
          )}
        </div>
      )
    }

    // Default to text input
    const isLongText = inputProp.description && inputProp.description.length > 100

    return (
      <div key={inputName} className="space-y-2">
        <label className={`text-sm font-medium flex items-center gap-1 ${themeClasses.text.primary}`}>
          {inputName}
          {isRequired && <span className="text-red-500">*</span>}
        </label>
        {isLongText ? (
          <Textarea
            value={String(currentValue)}
            onChange={(e) => updateToolInput(inputName, e.target.value)}
            placeholder={`Enter ${inputName}`}
            rows={3}
            className={themeClasses.input}
          />
        ) : (
          <Input
            type="text"
            value={String(currentValue)}
            onChange={(e) => updateToolInput(inputName, e.target.value)}
            placeholder={`Enter ${inputName}`}
            className={themeClasses.input}
          />
        )}
        {inputProp.description && (
          <p className={`text-xs ${themeClasses.text.secondary}`}>
            {inputProp.description}
          </p>
        )}
      </div>
    )
  }

  // =============================================================================
  // CONTENT RENDERING
  // =============================================================================

  const renderNetworkSwitchCard = () => {
    if (!tool?.isMonetized || !tool.pricing.length || !isConnected || isOnCorrectNetwork()) {
      return null
    }

    return (
      <div className={`p-3 rounded-md border ${themeClasses.background.warning}`}>
        <div className="flex items-start gap-3">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium mb-1">Network Mismatch</div>
            <div className="text-xs mb-3">
              This tool requires <strong>{getRequiredNetwork()}</strong> network, but you&apos;re connected to{" "}
              <strong>{getCurrentNetwork() || 'unknown network'}</strong>.
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleNetworkSwitch}
                disabled={isSwitchingNetwork}
                size="sm"
                className={`text-xs ${isDark
                    ? "bg-orange-600 hover:bg-orange-700 text-white"
                    : "bg-orange-600 hover:bg-orange-700 text-white"
                  }`}
              >
                {isSwitchingNetwork ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Switching...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Switch to {getRequiredNetwork()}
                  </>
                )}
              </Button>

              {/* Manual add network info */}
              {getRequiredNetwork() === 'sei-testnet' && (
                <Button
                  onClick={async () => {
                    const networkConfig = getNetworkConfig('sei-testnet')
                    if (!networkConfig) return
                    
                    const config = {
                      chainId: `0x${networkConfig.chainId.toString(16)}`,
                      chainName: networkConfig.name,
                      nativeCurrency: networkConfig.nativeCurrency,
                      rpcUrls: networkConfig.rpcUrls,
                      blockExplorerUrls: networkConfig.blockExplorerUrls,
                    }
                    await navigator.clipboard.writeText(JSON.stringify(config, null, 2))
                  }}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Manual Setup
                </Button>
              )}
            </div>

            {/* Manual Instructions for Sei Testnet */}
            {getRequiredNetwork() === 'sei-testnet' && (
              <div className="mt-3 p-2 rounded text-xs bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800">
                <div className="font-medium mb-1">Sei Testnet Network Details:</div>
                <div className="space-y-1 font-mono text-xs">
                  <div>Chain ID: 1328 (0x530)</div>
                  <div>RPC: https://evm-rpc-testnet.sei-apis.com</div>
                  <div>Symbol: SEI</div>
                  <div>Explorer: https://seitrace.com/?chain=atlantic-2</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderConnectionStatus = () => {
    if (!hasAccountWallets) {
      return (
        <div className={`p-4 rounded-md border ${themeClasses.background.warning}`}>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <p className="text-sm">Please connect a wallet to your account to execute this tool.</p>
          </div>
        </div>
      )
    }

    if (needsBrowserConnection) {
      return (
        <div className={`p-4 rounded-md border ${themeClasses.background.warning}`}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <div>
                <p className="text-sm font-medium">Browser wallet connection required</p>
                <p className="text-xs">
                  {!isBrowserWalletConnected 
                    ? `Connect your ${activeWallet?.provider || 'browser'} wallet to execute this tool.`
                    : `Please connect to the wallet address: ${formatWalletAddress(walletAddress || '')}`
                  }
                </p>
              </div>
            </div>
            <ConnectButton />
          </div>
        </div>
      )
    }

    if (needsWalletClient && !hasWalletClient) {
      return (
        <div className={`p-4 rounded-md border ${themeClasses.background.warning}`}>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <div>
              <p className="text-sm font-medium mb-1">Wallet client not ready</p>
              <p className="text-xs">Waiting for wallet client to be ready...</p>
            </div>
          </div>
        </div>
      )
    }

    if (!isInitialized && execution.status !== 'error') {
      return (
        <div className={`p-4 rounded-md border ${themeClasses.background.info}`}>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <p className="text-sm">Initializing MCP connection...</p>
          </div>
        </div>
      )
    }

    if (isInitialized && !mcpToolsCollection[stableTool?.name || '']) {
      return (
        <div className={`p-4 rounded-md border ${themeClasses.background.warning}`}>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <p className="text-sm">Tool &quot;{stableTool?.name}&quot; not found in MCP server.</p>
          </div>
          <p className="text-xs mt-1 opacity-80">
            Available tools: {Object.keys(mcpToolsCollection).join(', ') || 'None'}
          </p>
        </div>
      )
    }

    return null
  }

  const renderExecutionResult = () => {
    if (execution.status === 'success' && execution.result) {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Result
            </h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyResult(execution.result)}
              className={themeClasses.button}
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
          </div>
          <div className={`rounded-md border max-h-48 overflow-hidden ${themeClasses.background.code}`}>
            <pre className={`text-xs p-3 max-h-48 overflow-auto whitespace-pre ${themeClasses.text.error}`}>
              {(() => {
                if (execution.result === undefined) return 'No result'
                if (typeof execution.result === 'string') return execution.result
                try {
                  return JSON.stringify(execution.result, null, 2)
                } catch {
                  return String(execution.result)
                }
              })()}
            </pre>
          </div>
        </div>
      )
    }

    if (execution.status === 'error' && execution.error) {
      return (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            Error
          </h4>
          <div className={`text-sm p-3 rounded-md ${themeClasses.background.error}`}>
            {execution.error}
          </div>
        </div>
      )
    }

    return null
  }

  const renderContent = () => {
    if (!stableTool) return null

    const properties = getToolProperties(stableTool)
    const hasInputs = hasToolInputs(stableTool)

    return (
      <div className="space-y-6">
        {/* Wallet Selection */}
        {hasAccountWallets && (
          <div className={`p-4 rounded-xl border ${isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center gap-3 mb-3">
              <Wallet className={`h-4 w-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`} />
              <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Payment Wallet
              </h4>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className={`text-sm font-medium ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    {userWallets.length} Wallet{userWallets.length !== 1 ? 's' : ''} Connected
                  </span>
                </div>
                {userWallets.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowWalletSelection(!showWalletSelection)}
                    className={`text-xs ${isDark ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"}`}
                  >
                    {showWalletSelection ? "Hide Options" : "Change Wallet"}
                    <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${showWalletSelection ? 'rotate-180' : ''}`} />
                  </Button>
                )}
              </div>

              {/* Selected Wallet Display */}
              <div className={`p-3 rounded-lg border ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-300 bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {activeWallet?.isPrimary ? 'Primary Wallet' : 'Selected Wallet'}
                      </span>
                      {activeWallet?.isPrimary && (
                        <Badge variant="secondary" className="text-xs">Primary</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {formatWalletAddress(walletAddress || '')}
                      </span>
                      {activeWallet?.provider && (
                        <Badge variant="outline" className="text-xs">
                          {activeWallet.provider}
                        </Badge>
                      )}
                      {activeWallet?.walletType === 'external' && (
                        <Badge variant={needsBrowserConnection ? "destructive" : "default"} className="text-xs">
                          {needsBrowserConnection ? "Connect Required" : "Connected"}
                        </Badge>
                      )}
                      {activeWallet?.walletType === 'managed' && (
                        <Badge variant="secondary" className="text-xs">
                          Managed
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {navigator.clipboard.writeText(walletAddress || '')}}
                    className={`px-2 ml-2 ${isDark ? "border-gray-700 hover:bg-gray-800" : "border-gray-300 hover:bg-gray-50"}`}
                    title="Copy full address"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Wallet Selection Dropdown */}
              {showWalletSelection && userWallets.length > 1 && (
                <div className={`space-y-2 p-3 rounded-lg border ${isDark ? 'border-gray-700 bg-gray-800/30' : 'border-gray-300 bg-gray-50/50'}`}>
                  <h5 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
                    Select Payment Wallet
                  </h5>
                  {/* Sort wallets: primary first, then by creation date */}
                  {[...userWallets]
                    .sort((a, b) => {
                      if (a.isPrimary && !b.isPrimary) return -1
                      if (!a.isPrimary && b.isPrimary) return 1
                      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    })
                    .map((wallet) => (
                      <div
                        key={wallet.id}
                        onClick={() => {
                          setSelectedWallet(wallet)
                          setShowWalletSelection(false)
                        }}
                        className={`p-2 rounded-lg border cursor-pointer transition-all duration-200 ${
                          selectedWallet?.id === wallet.id
                            ? isDark 
                              ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/20' 
                              : 'border-blue-500 bg-blue-50 ring-1 ring-blue-500/20'
                            : isDark 
                              ? 'border-gray-600 bg-gray-700/50 hover:border-gray-500 hover:bg-gray-700' 
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <div className={`w-2 h-2 rounded-full ${
                            wallet.isActive ? "bg-green-500" : "bg-gray-400"
                          }`} />
                          <div className="text-left flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`font-mono text-sm font-medium ${
                                selectedWallet?.id === wallet.id
                                  ? isDark ? 'text-blue-200' : 'text-blue-700'
                                  : isDark ? 'text-gray-200' : 'text-gray-800'
                              }`}>
                                {formatWalletAddress(wallet.walletAddress)}
                              </span>
                              {wallet.isPrimary && (
                                <Badge variant="secondary" className="text-xs">Primary</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {wallet.provider && (
                                <Badge variant="outline" className={`text-xs ${
                                  selectedWallet?.id === wallet.id
                                    ? isDark ? 'border-blue-400/50 text-blue-300' : 'border-blue-400/50 text-blue-600'
                                    : ''
                                }`}>
                                  {wallet.provider}
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-xs">
                                {wallet.walletType}
                              </Badge>
                              {wallet.walletType === 'external' && (
                                <Badge 
                                  variant={
                                    isBrowserWalletConnected && connectedWalletAddress?.toLowerCase() === wallet.walletAddress.toLowerCase()
                                      ? "default" 
                                      : "destructive"
                                  } 
                                  className="text-xs"
                                >
                                  {isBrowserWalletConnected && connectedWalletAddress?.toLowerCase() === wallet.walletAddress.toLowerCase()
                                    ? "Connected" 
                                    : "Needs Connection"
                                  }
                                </Badge>
                              )}
                              <span className={`text-xs ${
                                selectedWallet?.id === wallet.id
                                  ? isDark ? 'text-blue-300' : 'text-blue-600'
                                  : isDark ? 'text-gray-400' : 'text-gray-500'
                              }`}>
                                {wallet.blockchain}
                              </span>
                            </div>
                          </div>
                          {selectedWallet?.id === wallet.id && (
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                              isDark ? 'bg-blue-500' : 'bg-blue-500'
                            }`}>
                              <CheckCircle className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {userWallets.length > 1 
                  ? `You can select any of your ${userWallets.length} connected wallets for payments`
                  : activeWallet?.isPrimary 
                    ? "Using your primary wallet from account settings"
                    : "Using your connected wallet for payments"
                }
                {activeWallet?.walletType === 'external' && (
                  <div className="mt-1">
                    <span className="font-medium">External wallet:</span> Requires browser connection for payments
                  </div>
                )}
                {activeWallet?.walletType === 'managed' && (
                  <div className="mt-1">
                    <span className="font-medium">Managed wallet:</span> Payments handled automatically
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tool Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{stableTool.name}</h3>
            {stableTool.isMonetized ? (
              <Badge variant="secondary" className={`text-xs flex items-center gap-1 ${isDark ? "bg-gray-600 text-gray-200" : ""}`}>
                <Coins className="h-3 w-3" />
                Paid
              </Badge>
            ) : (
              <Badge variant="outline" className={`text-xs ${isDark ? "border-gray-500 text-gray-300" : ""}`}>
                Free
              </Badge>
            )}
          </div>

          <p className={`text-sm ${themeClasses.text.secondary}`}>
            {(isInitialized && (mcpToolsCollection[stableTool.name] as MCPToolFromClient)?.description) || stableTool.description}
          </p>

          {stableTool.isMonetized && stableTool.pricing.length > 0 && (
            <div className={`p-3 rounded-md border ${themeClasses.background.success}`}>
              <div className="flex items-center gap-2 text-sm">
                <Coins className="h-4 w-4" />
                <span className="font-medium">Paid Tool</span>
              </div>
              <div className="mt-1 text-xs">
                <div className="flex items-center gap-1">
                  <span>Price:</span>
                  <TokenDisplay
                    currency={stableTool.pricing[0].currency}
                    network={stableTool.pricing[0].network}
                    amount={parseFloat(stableTool.pricing[0].priceRaw) / Math.pow(10, stableTool.pricing[0].tokenDecimals)}
                  />
                </div>
                <div>Network: {stableTool.pricing[0].network}</div>
              </div>
              <div className="mt-2 text-xs opacity-80">
                Payment will be automatically handled when you execute this tool.
              </div>
            </div>
          )}

          {/* Network Status Warning */}
          {renderNetworkSwitchCard()}
        </div>

        {/* Input Fields */}
        {hasInputs && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-md font-medium">Parameters</h4>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {Object.entries(properties).map(([inputName, inputProp]) =>
                renderInputField(inputName, inputProp)
              )}
            </div>
          </div>
        )}

        {/* Network Status Success */}
        {shouldShowNetworkStatus() && (
          <div className={`p-3 rounded-md border ${themeClasses.background.success}`}>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <div className="text-sm">
                <span className="font-medium">Ready to Execute</span>
                <span className="ml-2 text-xs opacity-80">
                  Connected to {getCurrentNetwork() || 'unknown'} network
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Connection Status */}
        {renderConnectionStatus()}

        {/* Execute Button */}
        <Button
          onClick={executeTool}
          disabled={
            !isConnected ||
            !isInitialized ||
            !mcpToolsCollection[stableTool.name] ||
            execution.status === 'executing' ||
            execution.status === 'initializing' ||
            (stableTool.isMonetized && !isOnCorrectNetwork()) ||
            isSwitchingNetwork
          }
          className={`w-full ${isDark ? "bg-blue-600 hover:bg-blue-700" : ""}`}
        >
          {execution.status === 'initializing' ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Initializing...
            </>
          ) : execution.status === 'executing' ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Executing...
            </>
          ) : isSwitchingNetwork ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Switching Network...
            </>
          ) : needsBrowserConnection ? (
            <>
              <Wallet className="h-4 w-4 mr-2" />
              Connect Wallet to Execute
            </>
          ) : stableTool.isMonetized && !isOnCorrectNetwork() ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Switch Network to Execute
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Execute Tool
            </>
          )}
        </Button>

        {/* Execution Result */}
        {renderExecutionResult()}
      </div>
    )
  }

  // =============================================================================
  // MODAL RENDERING
  // =============================================================================

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onClose}>
        <DrawerContent className={`max-h-[85vh] ${themeClasses.modal}`}>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Execute Tool
            </DrawerTitle>
            <DrawerDescription>
              Set parameters and run this MCP tool
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto">
            {renderContent()}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-2xl max-h-[85vh] overflow-hidden flex flex-col ${themeClasses.modal}`}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Execute Tool
          </DialogTitle>
          <DialogDescription>
            Set parameters and run this MCP tool
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex-1 overflow-y-auto">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  )
} 