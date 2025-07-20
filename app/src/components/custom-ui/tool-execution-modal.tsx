"use client"

import { useTheme } from "@/components/providers/theme-context"
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
  NETWORKS,
} from "@/lib/commons"
import { type Network } from "@/types/blockchain"
import { InputProperty, MCPClient, MCPToolFromClient, MCPToolsCollection, ToolExecutionModalProps, ToolInputSchema, type ToolFromMcpServerWithStats } from "@/types/mcp"
import { experimental_createMCPClient } from "ai"
import {
  AlertCircle,
  CheckCircle,
  Coins,
  Copy,
  Loader2,
  Play,
  RefreshCw,
  Wrench
} from "lucide-react"
import { createPaymentTransport } from "mcpay/client"
import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useAccount, useChainId, useWalletClient } from "wagmi"

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
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const chainId = useChainId()
  const themeClasses = getThemeClasses(isDark)
  
  // Create stable tool reference to avoid infinite loops
  const stableTool = useMemo(() => {
    if (!tool) return null
    return tool
  }, [tool?.id, tool?.name, JSON.stringify(tool?.inputSchema), tool?.description, tool?.isMonetized, JSON.stringify(tool?.pricing)])

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
      console.log(`[Network Switch] Network info:`, NETWORKS[requiredNetwork as Network])

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
        stack: error instanceof Error ? error.stack : undefined,
        requiredNetwork,
        availableNetworks: Object.keys(NETWORKS)
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

  // Track previous tool ID to avoid unnecessary resets
  const [previousToolId, setPreviousToolId] = useState<string | null>(null)

  useEffect(() => {
    if (!stableTool) {
      setPreviousToolId(null)
      return
    }

    // Only reset MCP initialization if the tool actually changed
    if (previousToolId !== stableTool.id) {
      setPreviousToolId(stableTool.id)
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
  }, [stableTool, previousToolId, getToolProperties])

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
    if (!isOpen || !isConnected || !address || !stableTool || !walletClient || isInitialized) return

    const initializeMcpClient = async () => {
      try {
        setExecution({ status: 'initializing' })

        // Create the MCP URL using the serverId
        const mcpUrl = new URL(urlUtils.getMcpUrl(serverId))

        // Create a viem-compatible Account object that x402 can use
        const account = walletClient

        console.log("Creating payment transport with viem account:", account);
        console.log("Wallet client chain info:", walletClient.chain);

        const transport = createPaymentTransport(new URL(mcpUrl), account, {
          maxPaymentValue: BigInt(0.1 * 10 ** 6), // 0.1 USDC max
          requestInit: {
            credentials: "include",
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
  }, [isOpen, isConnected, address, stableTool, serverId, walletClient, isInitialized])

  // Cleanup when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsInitialized(false)
      setMcpClient(null)
      setMcpToolsCollection({})
      setExecution({ status: 'idle' })
      setIsSwitchingNetwork(false)
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
    if (!stableTool || !mcpClient || !isInitialized || !walletClient) return

    setExecution({ status: 'executing' })

    try {
      // Get the MCP tool by name
      const mcpTool = mcpToolsCollection[stableTool.name] as MCPToolFromClient

      if (!mcpTool) {
        throw new Error(`Tool "${stableTool.name}" not found in MCP server`)
      }

      console.log(`Executing MCP tool: ${stableTool.name}`, toolInputs)
      console.log(`MCP tool schema:`, mcpTool.parameters?.jsonSchema || mcpTool.inputSchema?.jsonSchema)

      // Execute the tool using the MCP client's callTool method
      const result = await mcpTool.execute?.(toolInputs, {
        toolCallId: "123",
        messages: []
      })

      console.log(`Tool execution result:`, result)

      setExecution({
        status: 'success',
        result
      })
    } catch (error) {
      console.error("Tool execution error:", error)
      setExecution({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      })
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
                  onClick={() => {
                    const networkInfo = NETWORKS['sei-testnet']
                    const config = {
                      chainId: `0x${networkInfo.chainId.toString(16)}`,
                      chainName: networkInfo.name,
                      nativeCurrency: networkInfo.nativeCurrency,
                      rpcUrls: networkInfo.rpcUrls,
                      blockExplorerUrls: networkInfo.blockExplorerUrls,
                    }
                    navigator.clipboard.writeText(JSON.stringify(config, null, 2))
                    console.log('[Manual Network] Sei Testnet config:', config)
                    alert('Sei Testnet network config copied to clipboard!\n\nTo manually add:\n1. Open your wallet settings\n2. Go to Networks\n3. Add Custom Network\n4. Paste the config\n\nOr check browser console for details.')
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
    if (!isConnected || !walletClient) {
      return (
        <div className={`p-4 rounded-md border ${themeClasses.background.warning}`}>
          <p className="text-sm">
            {!isConnected
              ? "Please connect your wallet to execute this tool."
              : "Waiting for wallet client to be ready..."}
          </p>
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
            !walletClient ||
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