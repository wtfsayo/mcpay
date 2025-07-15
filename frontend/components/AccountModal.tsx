"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerHeader
} from "@/components/ui/drawer"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTheme } from "@/context/ThemeContext"
import { signIn, signOut, useSession } from "@/lib/auth"
import { openExplorer } from "@/lib/blockscout"
import type { UserWallet } from "@/lib/types"
import { api } from "@/lib/utils"
import {
  AlertCircle,
  CheckCircle,
  Copy,
  CreditCard,
  ExternalLink,
  Github,
  LogOut,
  Plus,
  Settings,
  Shield,
  Star,
  Trash2,
  User,
  Wallet,
  X
} from "lucide-react"
import React, { useEffect, useState } from "react"
import { useAccount, useDisconnect } from "wagmi"
import { ConnectButton } from "./connect-button"
import { toast } from "@/components/ui/toast"

interface AccountModalProps {
  isOpen: boolean
  onClose: () => void
  defaultTab?: 'profile' | 'wallets' | 'settings'
}

export function AccountModal({ isOpen, onClose, defaultTab = 'profile' }: AccountModalProps) {
  const { isDark } = useTheme()
  const { data: session, isPending: sessionLoading } = useSession()
  const { address: connectedWallet, isConnected } = useAccount()
  const { disconnect } = useDisconnect()

  const [activeTab, setActiveTab] = useState(defaultTab)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [userWallets, setUserWallets] = useState<UserWallet[]>([])
  const [isMobile, setIsMobile] = useState(false)
  const [totalFiatValue, setTotalFiatValue] = useState<number>(0)
  
  // Check for mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Load user wallets when authenticated
  useEffect(() => {
    if (session?.user?.id) {
      loadUserWallets()
    }
  }, [session?.user?.id])

  const loadUserWallets = async () => {
    if (!session?.user?.id) return
    
    try {
      const { wallets, totalFiatValue } = await api.getUserWallets(session.user.id)
      setUserWallets(wallets)
      setTotalFiatValue(totalFiatValue)
    } catch (error) {
      console.error('Failed to load user wallets:', error)
    }
  }

  const handleGitHubSignIn = async () => {
    setIsLoading(true)
    setError("")
    
    try {
      await signIn.social({ 
        provider: "github", 
        callbackURL: window.location.origin 
      })
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to sign in with GitHub")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = async () => {
    setIsLoading(true)
    try {
      await signOut()
      if (isConnected) {
        disconnect()
      }
      setUserWallets([])
    } catch (error) {
      console.error('Failed to sign out:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnectWallet = async () => {
    if (!session?.user?.id || !connectedWallet) return

    setIsLoading(true)
    try {
      await api.addWalletToUser(session.user.id, {
        walletAddress: connectedWallet,
        blockchain: 'ethereum',
        walletType: 'external',
        provider: 'metamask',
        isPrimary: userWallets.length === 0,
      })
      await loadUserWallets()
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to connect wallet")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetPrimaryWallet = async (walletId: string) => {
    if (!session?.user?.id) return

    setIsLoading(true)
    try {
      await api.setWalletAsPrimary(session.user.id, walletId)
      await loadUserWallets()
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to set primary wallet")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveWallet = async (walletId: string, isPrimary: boolean) => {
    if (!session?.user?.id) return

    // Confirm removal, especially for primary wallets
    const confirmMessage = isPrimary 
      ? "Are you sure you want to remove your primary wallet? This will affect your account access."
      : "Are you sure you want to remove this wallet?"
    
    if (!confirm(confirmMessage)) return

    setIsLoading(true)
    try {
      await api.removeWallet(session.user.id, walletId)
      await loadUserWallets()
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to remove wallet")
    } finally {
      setIsLoading(false)
    }
  }

  const handleBuyCrypto = async () => {
    if (!session?.user?.id) return

    setIsLoading(true)
    try {
      const response = await api.createOnrampUrl(session.user.id, {
        redirectUrl: window.location.origin
      })
      
      if (response.onrampUrl) {
        // Open Coinbase Onramp in a new window
        window.open(response.onrampUrl, '_blank', 'noopener,noreferrer')
        toast.success("Redirecting to Coinbase to buy crypto...")
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to create buy crypto URL")
      toast.error("Failed to open buy crypto flow")
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  // GitHub Sign In Component
  const GitHubSignIn = () => (
    <div className="space-y-5 p-1">
      <div className="text-center">
        <div className={`w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center ${
          isDark ? "bg-gray-800/50" : "bg-gray-50"
        }`}>
          <Github className={`h-6 w-6 ${isDark ? "text-gray-300" : "text-gray-600"}`} />
        </div>
        <h2 className={`text-xl font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
          Sign in to MCPay
        </h2>
        <p className={`text-sm mt-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
          Connect with your GitHub account
        </p>
      </div>

      {error && (
        <div className={`p-3 rounded-lg border ${
          isDark ? "bg-red-950/50 border-red-800/50 text-red-400" : "bg-red-50 border-red-200 text-red-700"
        }`}>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      <Button
        type="button"
        onClick={handleGitHubSignIn}
        disabled={isLoading}
        className="w-full h-11 text-[15px] font-medium"
        size="lg"
      >
        <Github className="h-4 w-4 mr-3" />
        {isLoading ? "Connecting..." : "Continue with GitHub"}
      </Button>

      <div className={`text-center text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>
        By continuing, you agree to our Terms of Service and Privacy Policy
      </div>
    </div>
  )

  // Authenticated User Interface
  const AuthenticatedInterface = () => (
    <div className="space-y-4">
      {/* User Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isDark ? "bg-gray-800/50" : "bg-gray-50"
          }`}>
            {session?.user?.image ? (
              <img 
                src={session.user.image} 
                alt="Profile" 
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <User className={`h-5 w-5 ${isDark ? "text-gray-300" : "text-gray-600"}`} />
            )}
          </div>
          <div>
            <h3 className={`font-medium text-[15px] ${isDark ? "text-white" : "text-gray-900"}`}>
              {session?.user?.name || "User"}
            </h3>
            <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              {session?.user?.email}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          disabled={isLoading}
          className={`h-8 w-8 p-0 ${isDark ? "text-gray-400 hover:text-white hover:bg-gray-800" : "hover:bg-gray-100"}`}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      <div className={`h-px ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'profile' | 'wallets' | 'settings')} className="w-full">
        <TabsList className={`grid w-full grid-cols-3 h-9 ${isDark ? "bg-gray-800/50" : "bg-gray-100"}`}>
          <TabsTrigger value="profile" className="text-sm">
            <User className="h-3.5 w-3.5 mr-1.5" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="wallets" className="text-sm">
            <Wallet className="h-3.5 w-3.5 mr-1.5" />
            Wallets
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-sm">
            <Settings className="h-3.5 w-3.5 mr-1.5" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-3 mt-4">
          <div className={`rounded-lg border p-4 ${isDark ? "bg-gray-900/50 border-gray-800" : "bg-gray-50/50 border-gray-200"}`}>
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4" />
              <h4 className={`font-medium text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
                Profile Information
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`text-xs font-medium block mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  Name
                </label>
                <p className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  {session?.user?.name || "Not set"}
                </p>
              </div>
              <div>
                <label className={`text-xs font-medium block mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  Email
                </label>
                <div className="flex items-center gap-1.5">
                  <p className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    {session?.user?.email?.slice(0, 20)}...
                  </p>
                  {session?.user?.emailVerified ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-orange-500" />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className={`rounded-lg border p-4 ${isDark ? "bg-gray-900/50 border-gray-800" : "bg-gray-50/50 border-gray-200"}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="h-4 w-4" />
                  <h4 className={`font-medium text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
                    Portfolio Value
                  </h4>
                </div>
                <p className={`text-2xl font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                  ${parseFloat(String(totalFiatValue || 0)).toFixed(2)}
                </p>
                <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  {userWallets.length} wallet{userWallets.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className={`p-2.5 rounded-lg ${isDark ? "bg-green-900/20" : "bg-green-100"}`}>
                <Wallet className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Wallets Tab */}
        <TabsContent value="wallets" className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className={`font-medium text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
                Connected Wallets
              </h4>
              <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Manage your blockchain wallets
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleBuyCrypto}
                disabled={isLoading || userWallets.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs px-3"
              >
                <CreditCard className="h-3 w-3 mr-1.5" />
                Buy Crypto
              </Button>
              {isConnected && !userWallets.find(w => w.walletAddress.toLowerCase() === connectedWallet?.toLowerCase()) && (
                <Button
                  size="sm"
                  onClick={handleConnectWallet}
                  disabled={isLoading}
                  className="h-8 text-xs px-3"
                >
                  <Plus className="h-3 w-3 mr-1.5" />
                  Link Wallet
                </Button>
              )}
            </div>
          </div>

          {/* Current Connected Wallet (if not linked to account) */}
          {isConnected && !userWallets.find(w => w.walletAddress.toLowerCase() === connectedWallet?.toLowerCase()) && (
            <div className={`border border-dashed rounded-lg p-3 ${isDark ? "border-gray-700 bg-gray-800/30" : "border-gray-300 bg-gray-50"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Wallet className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                      Connected Wallet
                    </p>
                    <p className={`text-xs font-mono ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                      {connectedWallet?.slice(0, 6)}...{connectedWallet?.slice(-4)}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">Not Linked</Badge>
              </div>
            </div>
          )}

          {/* Wallet Connection Component */}
          <div className={`rounded-lg border p-4 ${isDark ? "bg-gray-900/50 border-gray-800" : "bg-gray-50/50 border-gray-200"}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className={`font-medium text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
                  Native Wallet
                </h4>
                <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  Connect MetaMask, Coinbase Wallet, etc.
                </p>
              </div>
            </div>
            
            {!isConnected ? (
              <div className="text-center py-3">
                <Wallet className={`h-6 w-6 mx-auto mb-2 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
                <p className={`text-xs mb-3 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  No native wallet connected
                </p>
                <ConnectButton />
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <div>
                    <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                      Connected
                    </p>
                    <p className={`text-xs font-mono ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                      {connectedWallet?.slice(0, 6)}...{connectedWallet?.slice(-4)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!userWallets.find(w => w.walletAddress.toLowerCase() === connectedWallet?.toLowerCase()) && (
                    <Button
                      size="sm"
                      onClick={handleConnectWallet}
                      disabled={isLoading}
                      className="h-7 text-xs px-2"
                    >
                      Link
                    </Button>
                  )}
                  <ConnectButton />
                </div>
              </div>
            )}
          </div>

          {/* User's Linked Wallets */}
          <div className="space-y-2">
            {userWallets.map((wallet) => (
              <div key={wallet.id} className={`rounded-lg border p-3 ${isDark ? "bg-gray-900/50 border-gray-800" : "bg-white border-gray-200"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <Wallet className="h-4 w-4" />
                      {wallet.isPrimary && (
                        <Star className="h-2.5 w-2.5 text-yellow-500 absolute -top-0.5 -right-0.5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                          {wallet.walletAddress.slice(0, 6)}...{wallet.walletAddress.slice(-4)}
                        </p>
                        {wallet.isPrimary && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">Primary</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          {wallet.blockchain}
                        </Badge>
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          {wallet.walletType}
                        </Badge>
                        {wallet.provider && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0">
                            {wallet.provider}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(wallet.walletAddress)}
                      className="h-7 w-7 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openExplorer(wallet.walletAddress, 'base-sepolia')}
                      className="h-7 w-7 p-0"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                    {!wallet.isPrimary && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetPrimaryWallet(wallet.id)}
                        disabled={isLoading}
                        className="h-7 px-2 text-xs"
                      >
                        <Star className="h-3 w-3 mr-1" />
                        Primary
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveWallet(wallet.id, wallet.isPrimary)}
                      disabled={isLoading}
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-400"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-3 mt-4">
          <div className={`rounded-lg border p-4 ${isDark ? "bg-gray-900/50 border-gray-800" : "bg-gray-50/50 border-gray-200"}`}>
            <div className="flex items-center gap-2 mb-3">
              <Settings className="h-4 w-4" />
              <h4 className={`font-medium text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
                Account Settings
              </h4>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`font-medium text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
                    Email Verification
                  </p>
                  <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    {session?.user?.emailVerified ? "Your email is verified" : "Please verify your email"}
                  </p>
                </div>
                {session?.user?.emailVerified ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Button variant="outline" size="sm" className="h-7 text-xs px-3">
                    Verify
                  </Button>
                )}
              </div>
              <div className={`h-px ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
              <div className="flex items-center justify-between">
                <div>
                  <p className={`font-medium text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
                    Two-Factor Authentication
                  </p>
                  <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    Add an extra layer of security
                  </p>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs px-3">
                  <Shield className="h-3 w-3 mr-1.5" />
                  Enable
                </Button>
              </div>
              <div className={`h-px ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
              <div className="flex items-center justify-between">
                <div>
                  <p className={`font-medium text-sm text-red-600`}>
                    Delete Account
                  </p>
                  <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    Permanently delete your account and all data
                  </p>
                </div>
                <Button variant="destructive" size="sm" className="h-7 text-xs px-3">
                  <Trash2 className="h-3 w-3 mr-1.5" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )

  const LoadingSpinner = () => (
    <div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
    </div>
  )

  const ModalHeader = ({ Component }: { Component: any }) => (
    <Component>
      <div className="text-lg font-semibold">
        {session?.user ? "Account" : "Sign In"}
      </div>
    </Component>
  )

  if (sessionLoading) {
    if (isMobile) {
      return (
        <Drawer open={isOpen} onOpenChange={onClose}>
          <DrawerContent className={isDark ? "bg-gray-900 border-gray-800" : ""}>
            <LoadingSpinner />
          </DrawerContent>
        </Drawer>
      )
    }
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className={`max-w-md ${isDark ? "bg-gray-900 border-gray-800" : ""}`}>
          <LoadingSpinner />
        </DialogContent>
      </Dialog>
    )
  }

  // Mobile drawer
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onClose}>
        <DrawerContent className={`h-[65vh] ${isDark ? "bg-gray-900 border-gray-800" : ""}`}>
          <ModalHeader Component={DrawerHeader} />
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            {session?.user ? <AuthenticatedInterface /> : <GitHubSignIn />}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  // Desktop dialog
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-lg h-[70vh] flex flex-col ${isDark ? "bg-gray-900 border-gray-800" : ""}`}>
        <ModalHeader Component={DialogHeader} />
        <div className="flex-1 overflow-y-auto px-1">
          {session?.user ? <AuthenticatedInterface /> : <GitHubSignIn />}
        </div>
      </DialogContent>
    </Dialog>
  )
} 