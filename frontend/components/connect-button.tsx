"use client"



import { useState, useEffect } from "react"
import { useConnect, useAccount, useDisconnect, useChainId, useBalance, type Connector } from "wagmi"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, ChevronDown, LogOut, Wallet, ExternalLink, AlertTriangle, CheckCircle, RefreshCw, DollarSign } from "lucide-react"
import { openBlockscout } from "@/lib/blockscout"
import {
  verifyMetaMaskConnection,
  verifyWalletConnection,
  getConnectionStatus,
  isMetaMaskConnector,
  isMetaMaskAvailable,
  isCoinbaseWalletConnector,
  isCoinbaseWalletAvailable,
  isPortoConnector,
  isPortoAvailable,
  switchToBaseSepolia,
  switchToBaseSepoliaGeneric
} from "@/lib/wallet-utils"
import { getTokenInfo, formatTokenAmount, type Network, getNetworkByChainId } from "@/lib/tokens"

export function ConnectButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [connectionError, setConnectionError] = useState<string>("")
  const [showDetails, setShowDetails] = useState(false)

  const { connect, connectors, error: connectError } = useConnect()
  const { address, isConnected, connector } = useAccount()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()

  // Get network info
  const network = getNetworkByChainId(chainId) as Network

  // Get USDC token info for current network
  const usdcAddress = network === 'base-sepolia'
    ? '0x036cbd53842c5426634e7929541ec2318f3dcf7e'
    : network === 'base'
      ? '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
      : undefined

  const usdcToken = usdcAddress ? getTokenInfo(usdcAddress, network) : undefined

  // Fetch USDC balance
  const { data: usdcBalance, isLoading: isLoadingUsdcBalance } = useBalance({
    address: address,
    token: usdcAddress as `0x${string}`,
    query: {
      enabled: !!(address && usdcAddress && isConnected),
      refetchInterval: 10000, // Refetch every 10 seconds
    }
  })

  // Get connection status and verification
  const connectionStatus = getConnectionStatus(isConnected, address, connector, chainId)
  const verification = verifyWalletConnection(isConnected, address, connector)

  // Handle connection errors
  useEffect(() => {
    if (connectError) {
      setConnectionError(connectError.message)
    } else {
      setConnectionError("")
    }
  }, [connectError])

  const handleConnect = async (connector: Connector) => {
    try {
      setIsLoading(true)
      setConnectionError("")

      // If connecting to MetaMask and wrong network, try to switch first
      if (isMetaMaskConnector(connector) && isMetaMaskAvailable()) {
        try {
          await switchToBaseSepolia()
        } catch (error) {
          console.warn("Could not switch network before connecting:", error)
          // Continue with connection anyway
        }
      }
      // If connecting to Coinbase Wallet and wrong network, try generic switch
      else if (isCoinbaseWalletConnector(connector) && isCoinbaseWalletAvailable()) {
        try {
          await switchToBaseSepoliaGeneric()
        } catch (error) {
          console.warn("Could not switch network before connecting:", error)
          // Continue with connection anyway
        }
      }
      // If connecting to Porto and wrong network, try generic switch
      else if (isPortoConnector(connector)) {
        try {
          // await switchToBaseSepoliaGeneric()
          console.log("Switched to Base Sepolia")
        } catch (error) {
          console.warn("Could not switch network before connecting:", error)
          // Continue with connection anyway
        }
      }

      console.log("Connecting to connector:", connector)

      connect({ connector })
    } catch (error) {
      console.error("Connection error:", error)
      setConnectionError(error instanceof Error ? error.message : "Failed to connect")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      setIsLoading(true)
      setConnectionError("")
      disconnect()
    } catch (error) {
      console.error("Disconnection error:", error)
      setConnectionError(error instanceof Error ? error.message : "Failed to disconnect")
    } finally {
      setIsLoading(false)
    }
  }

  const handleNetworkSwitch = async () => {
    try {
      setIsLoading(true)

      // Use appropriate network switching method based on connector
      if (connector && isMetaMaskConnector(connector)) {
        const success = await switchToBaseSepolia()
        if (!success) {
          setConnectionError("Failed to switch to Base Sepolia network")
        }
      } else {
        // Use generic switching for other wallets including Coinbase Wallet and Porto
        const success = await switchToBaseSepoliaGeneric()
        if (!success) {
          setConnectionError("Failed to switch to Base Sepolia network")
        }
      }
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : "Failed to switch network")
    } finally {
      setIsLoading(false)
    }
  }

  // Format address for display
  const formatAddress = (address?: string) => {
    if (!address) return ""
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  // Format balance for display
  const formatBalance = (balance: bigint | undefined, decimals: number, symbol: string) => {
    if (!balance) return "0.00"
    const formatted = Number(balance) / Math.pow(10, decimals)
    return `${formatted.toFixed(2)} ${symbol}`
  }

  // Get preferred connectors
  const metaMaskConnector = connectors.find(c => isMetaMaskConnector(c))
  const coinbaseConnector = connectors.find(c => isCoinbaseWalletConnector(c))
  const portoConnector = connectors.find(c => isPortoConnector(c))

  if (isConnected && address) {
    const isMetaMask = connector ? isMetaMaskConnector(connector) : false
    const isCoinbaseWallet = connector ? isCoinbaseWalletConnector(connector) : false
    const isPorto = connector ? isPortoConnector(connector) : false
    const isCorrectNetwork = chainId === 84532 // Base Sepolia


    return (
      <div className="space-y-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              {formatAddress(address)}
              {isMetaMask && <Badge variant="outline" className="text-xs">MetaMask</Badge>}
              {isCoinbaseWallet && <Badge variant="outline" className="text-xs">Coinbase</Badge>}
              {isPorto && <Badge variant="outline" className="text-xs">Porto</Badge>}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            {/* Connection Status */}
            <div className="px-3 py-2 border-b">
              <div className="flex items-center gap-2">
                {verification.isValid ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                )}
                <span className="text-sm font-medium">
                  {verification.isValid ? "Connected" : "Connection Issues"}
                </span>
                {network === 'base-sepolia' && (
                  <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
                    Testnet
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {connector?.name} • {network?.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
              </p>
            </div>

            {/* Balance Information */}
            <div className="px-3 py-3 border-b bg-gray-50/50 dark:bg-gray-800/50">
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Balances</span>
                </div>

                {/* USDC Balance */}
                {usdcToken && (
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-600 dark:text-gray-400">USDC</span>
                    </div>
                    <span className="text-xs font-mono">
                      {isLoadingUsdcBalance ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : usdcBalance ? (
                        formatBalance(usdcBalance.value, usdcBalance.decimals, "USDC")
                      ) : (
                        "0.00 USDC"
                      )}
                    </span>
                  </div>
                )}

                {!usdcToken && isCorrectNetwork && (
                  <div className="text-xs text-gray-500 italic">
                    USDC not available on this network
                  </div>
                )}
              </div>
            </div>

            {/* Network Switch Option */}
            {!isCorrectNetwork && (
              <DropdownMenuItem onClick={handleNetworkSwitch} className="cursor-pointer">
                <RefreshCw className="mr-2 h-4 w-4" />
                Switch to Base Sepolia
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              onClick={() => openBlockscout(address)}
              className="cursor-pointer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View on Explorer
            </DropdownMenuItem>

            <DropdownMenuItem onClick={handleDisconnect} className="cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Connection Warnings */}
        {verification.warnings.length > 0 && (
          <Alert className="w-full">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {verification.warnings[0]}
              {verification.warnings.length > 1 && (
                <span className="text-gray-500"> (+{verification.warnings.length - 1} more)</span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Network Warning */}
        {!isCorrectNetwork && (
          <Alert className="w-full">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Wrong network. Please switch to Base Sepolia for full functionality.
            </AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting
              </>
            ) : (
              <>Connect Wallet</>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">

          {/* MetaMask Second (if available) */}
          {metaMaskConnector && (
            <DropdownMenuItem
              key={metaMaskConnector.id}
              onClick={() => handleConnect(metaMaskConnector)}
              className="cursor-pointer"
            >
              <div className="flex items-center justify-between w-full">
                <span>{metaMaskConnector.name}</span>
                <Badge variant="outline" className="text-xs">Recommended</Badge>
              </div>
            </DropdownMenuItem>
          )}

          {/* Coinbase Wallet Third (if available) */}
          {coinbaseConnector && (
            <DropdownMenuItem
              key={coinbaseConnector.id}
              onClick={() => handleConnect(coinbaseConnector)}
              className="cursor-pointer"
            >
              <div className="flex items-center justify-between w-full">
                <span>{coinbaseConnector.name}</span>
                <Badge variant="outline" className="text-xs">Popular</Badge>
              </div>
            </DropdownMenuItem>
          )}

          {/* Porto First (if available) - Featured for Web3 payments */}
          {portoConnector && (
            <DropdownMenuItem
              key={portoConnector.id}
              onClick={() => handleConnect(portoConnector)}
              className="cursor-pointer"
            >
              <div className="flex items-center justify-between w-full">
                <span>{portoConnector.name}</span>
              </div>
            </DropdownMenuItem>
          )}


          {/* Other Connectors */}
          {connectors
            .filter(connector =>
              !isMetaMaskConnector(connector) &&
              !isCoinbaseWalletConnector(connector) &&
              !isPortoConnector(connector)
            )
            .map((connector) => (
              <DropdownMenuItem
                key={connector.id}
                onClick={() => handleConnect(connector)}
                className="cursor-pointer"
              >
                {connector.name}
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Connection Errors */}
      {connectionError && (
        <Alert className="w-full">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {connectionError}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
