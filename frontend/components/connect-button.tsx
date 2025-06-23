"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { AddressLink } from "./ExplorerLink"
import { getNetworkByChainId, getTokenInfo, NETWORKS, type Network } from "@/lib/tokens"
import {
  getConnectionStatus,
  isCoinbaseWalletConnector,
  isMetaMaskConnector,
  isPortoConnector,
  switchToNetwork,
  verifyWalletConnection
} from "@/lib/wallet-utils"
import { AlertTriangle, CheckCircle, ChevronDown, DollarSign, ExternalLink, Loader2, LogOut, RefreshCw, Wallet, Network as NetworkIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useAccount, useBalance, useChainId, useConnect, useDisconnect, type Connector } from "wagmi"

export function ConnectButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [connectionError, setConnectionError] = useState<string>("")
  const [isNetworkSwitching, setIsNetworkSwitching] = useState(false)

  const { connect, connectors, error: connectError } = useConnect()
  const { address, isConnected, connector } = useAccount()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()

  // Multi-chain support - define supported chains
  const supportedChains: Network[] = ['base-sepolia', 'sei-testnet', 'base', 'ethereum']
  const currentNetwork = getNetworkByChainId(chainId) as Network
  const defaultNetwork: Network = 'base-sepolia'
  
  const connectionStatus = getConnectionStatus(isConnected, address, connector, chainId, currentNetwork)
  const verification = verifyWalletConnection(isConnected, address, connector)

  // Multi-chain USDC addresses
  const usdcAddresses: Record<Network, string> = {
    'base-sepolia': '0x036cbd53842c5426634e7929541ec2318f3dcf7e',
    'base': '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    'sei-testnet': '0xeAcd10aaA6f362a94823df6BBC3C536841870772',
    'ethereum': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    'arbitrum': '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    'optimism': '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
    'polygon': '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
  }

  // Multi-chain balance fetching
  const createBalanceQuery = (network: Network) => {
    const usdcAddress = usdcAddresses[network]
    return {
      address: address,
      token: usdcAddress as `0x${string}`,
      chainId: NETWORKS[network].chainId,
      query: {
        enabled: !!(address && usdcAddress && isConnected),
        refetchInterval: 30000, // Refetch every 30 seconds
      }
    }
  }

  // Fetch balances for all supported chains
  const balanceQueries = supportedChains.map(network => ({
    network,
    ...useBalance(createBalanceQuery(network))
  }))

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

      // Try to switch to default network before connecting
      try {
        await switchToNetwork(defaultNetwork)
        console.log(`Switched to ${NETWORKS[defaultNetwork].name}`)
      } catch (error) {
        console.warn("Could not switch network before connecting:", error)
        // Continue with connection anyway
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

  const handleNetworkSwitch = async (targetNetwork: Network) => {
    try {
      setIsNetworkSwitching(true)
      setConnectionError("")

      const success = await switchToNetwork(targetNetwork)
      if (!success) {
        setConnectionError(`Failed to switch to ${NETWORKS[targetNetwork].name} network`)
      }
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : "Failed to switch network")
    } finally {
      setIsNetworkSwitching(false)
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

  // Get network icon/status
  const getNetworkStatus = (network: Network, isCurrent: boolean) => {
    const networkInfo = NETWORKS[network]
    return {
      name: networkInfo.name,
      isTestnet: networkInfo.isTestnet,
      isCurrent,
      isSupported: supportedChains.includes(network)
    }
  }

  // Get preferred connectors
  const metaMaskConnector = connectors.find(c => isMetaMaskConnector(c))
  const coinbaseConnector = connectors.find(c => isCoinbaseWalletConnector(c))
  const portoConnector = connectors.find(c => isPortoConnector(c))

  if (isConnected && address) {
    const isMetaMask = connector ? isMetaMaskConnector(connector) : false
    const isCoinbaseWallet = connector ? isCoinbaseWalletConnector(connector) : false
    const isPorto = connector ? isPortoConnector(connector) : false
    const currentNetworkInfo = currentNetwork ? NETWORKS[currentNetwork] : null
    const isOnSupportedNetwork = supportedChains.includes(currentNetwork)

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
          <DropdownMenuContent align="end" className="w-96">
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
                {currentNetworkInfo?.isTestnet && (
                  <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
                    Testnet
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {connector?.name} • {currentNetwork ? NETWORKS[currentNetwork].name : 'Unknown Network'}
              </p>
            </div>

            {/* Current Network Status */}
            <div className="px-3 py-2 border-b bg-blue-50/50 dark:bg-blue-900/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <NetworkIcon className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Current Network</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{currentNetworkInfo?.name || 'Unknown'}</span>
                  {isOnSupportedNetwork ? (
                    <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                      Supported
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
                      Unsupported
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Multi-Chain Balances */}
            <div className="px-3 py-3 border-b bg-gray-50/50 dark:bg-gray-800/50">
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Multi-Chain USDC Balances</span>
                </div>

                {balanceQueries.map(({ network, data: balance, isLoading: isLoadingBalance, error }) => {
                  const networkInfo = NETWORKS[network]
                  const usdcToken = getTokenInfo(usdcAddresses[network], network)
                  const isCurrent = network === currentNetwork

                  return (
                    <div key={network} className={`flex justify-between items-center p-2 rounded ${isCurrent ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-blue-500' : networkInfo.isTestnet ? 'bg-orange-400' : 'bg-green-500'}`} />
                        <span className="text-xs font-medium">{networkInfo.name}</span>
                        {networkInfo.isTestnet && <Badge variant="outline" className="text-xs">Testnet</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono">
                          {isLoadingBalance ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : error ? (
                            <span className="text-red-500">Error</span>
                          ) : balance ? (
                            formatBalance(balance.value, balance.decimals, "USDC")
                          ) : (
                            "0.00 USDC"
                          )}
                        </span>
                        {!isCurrent && (
                          <Button
                            onClick={() => handleNetworkSwitch(network)}
                            disabled={isNetworkSwitching}
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                          >
                            {isNetworkSwitching ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Switch"
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Quick Network Switch */}
            {!isOnSupportedNetwork && (
              <>
                <DropdownMenuSeparator />
                <div className="px-3 py-2">
                  <p className="text-xs text-amber-600 mb-2">⚠️ Switch to a supported network:</p>
                  <div className="grid grid-cols-2 gap-1">
                    {supportedChains.slice(0, 4).map((network) => (
                      <Button
                        key={network}
                        onClick={() => handleNetworkSwitch(network)}
                        disabled={isNetworkSwitching}
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
                      >
                        {NETWORKS[network].name}
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem className="p-0">
              <AddressLink
                address={address}
                network={currentNetwork}
                variant="button"
                showExplorerName={true}
                className="w-full justify-start"
              />
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
        {!isOnSupportedNetwork && currentNetworkInfo && (
          <Alert className="w-full">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Unsupported network. Switch to: {supportedChains.map(n => NETWORKS[n].name).join(', ')}
            </AlertDescription>
          </Alert>
        )}

        {/* Network Switching Loading */}
        {isNetworkSwitching && (
          <Alert className="w-full">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription className="text-xs">
              Switching networks...
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
          {/* MetaMask (if available) */}
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

          {/* Coinbase Wallet (if available) */}
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

          {/* Porto (if available) */}
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
