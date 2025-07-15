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
      const wallets = await api.getUserWallets(session.user.id)
      setUserWallets(wallets)
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  // GitHub Sign In Component
  const GitHubSignIn = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
          isDark ? "bg-gray-800" : "bg-gray-100"
        }`}>
          <Github className={`h-8 w-8 ${isDark ? "text-gray-300" : "text-gray-600"}`} />
        </div>
        <h2 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
          Connect with GitHub
        </h2>
        <p className={`text-sm mt-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
          Sign in to your MCPay account using GitHub
        </p>
      </div>

      {error && (
        <div className={`p-3 rounded-lg border ${
          isDark ? "bg-red-900/20 border-red-800 text-red-400" : "bg-red-50 border-red-200 text-red-700"
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
        className="w-full"
        size="lg"
      >
        <Github className="h-5 w-5 mr-3" />
        {isLoading ? "Connecting..." : "Continue with GitHub"}
      </Button>

      <div className={`text-center text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
        By continuing, you agree to our Terms of Service and Privacy Policy
      </div>
    </div>
  )

  // Authenticated User Interface
  const AuthenticatedInterface = () => (
    <div className="space-y-6">
      {/* User Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            isDark ? "bg-gray-800" : "bg-gray-100"
          }`}>
            {session?.user?.image ? (
              <img 
                src={session.user.image} 
                alt="Profile" 
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <User className={`h-6 w-6 ${isDark ? "text-gray-300" : "text-gray-600"}`} />
            )}
          </div>
          <div>
            <h3 className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
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
          className={isDark ? "text-gray-400 hover:text-white" : ""}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      <Separator />

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'profile' | 'wallets' | 'settings')} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="wallets">
            <Wallet className="h-4 w-4 mr-2" />
            Wallets
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4 mt-6">
          <Card className={isDark ? "bg-gray-800 border-gray-700" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Your account details and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`text-sm font-medium block mb-1 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    Name
                  </label>
                  <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    {session?.user?.name || "Not set"}
                  </p>
                </div>
                <div>
                  <label className={`text-sm font-medium block mb-1 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    Email
                  </label>
                  <div className="flex items-center gap-2">
                    <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                      {session?.user?.email}
                    </p>
                    {session?.user?.emailVerified ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Wallets Tab */}
        <TabsContent value="wallets" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                Connected Wallets
              </h4>
              <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Manage your blockchain wallets
              </p>
            </div>
            {isConnected && !userWallets.find(w => w.walletAddress.toLowerCase() === connectedWallet?.toLowerCase()) && (
              <Button
                size="sm"
                onClick={handleConnectWallet}
                disabled={isLoading}
              >
                <Plus className="h-4 w-4 mr-2" />
                Connect Current Wallet
              </Button>
            )}
          </div>

          {/* Current Connected Wallet (if not linked to account) */}
          {isConnected && !userWallets.find(w => w.walletAddress.toLowerCase() === connectedWallet?.toLowerCase()) && (
            <Card className={`border-2 border-dashed ${isDark ? "border-gray-600 bg-gray-800/50" : "border-gray-300 bg-gray-50"}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Wallet className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                        Connected Wallet
                      </p>
                      <p className={`text-xs font-mono ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                        {connectedWallet?.slice(0, 6)}...{connectedWallet?.slice(-4)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">Not Linked</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Wallet Connection Component */}
          <Card className={isDark ? "bg-gray-800 border-gray-700" : ""}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                    Native Wallet Connection
                  </h4>
                  <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    Connect wallets like MetaMask, Coinbase Wallet, etc.
                  </p>
                </div>
              </div>
              
              {!isConnected ? (
                <div className="text-center py-4">
                  <Wallet className={`h-8 w-8 mx-auto mb-3 ${isDark ? "text-gray-400" : "text-gray-600"}`} />
                  <p className={`text-sm mb-4 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    No native wallet connected
                  </p>
                  <ConnectButton />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <div>
                        <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                          Connected Wallet
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
                        >
                          Link to Account
                        </Button>
                      )}
                      <ConnectButton />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* User's Linked Wallets */}
          <div className="space-y-3">
            {userWallets.map((wallet) => (
              <Card key={wallet.id} className={isDark ? "bg-gray-800 border-gray-700" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Wallet className="h-5 w-5" />
                        {wallet.isPrimary && (
                          <Star className="h-3 w-3 text-yellow-500 absolute -top-1 -right-1" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                            {wallet.walletAddress.slice(0, 6)}...{wallet.walletAddress.slice(-4)}
                          </p>
                          {wallet.isPrimary && (
                            <Badge variant="secondary" className="text-xs">Primary</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {wallet.blockchain}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {wallet.walletType}
                          </Badge>
                          {wallet.provider && (
                            <Badge variant="outline" className="text-xs">
                              {wallet.provider}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(wallet.walletAddress)}
                        className="h-8 w-8 p-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openExplorer(wallet.walletAddress, 'base-sepolia')}
                        className="h-8 w-8 p-0"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                      {!wallet.isPrimary && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetPrimaryWallet(wallet.id)}
                          disabled={isLoading}
                          className="h-8 px-2"
                        >
                          <Star className="h-3 w-3 mr-1" />
                          Set Primary
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveWallet(wallet.id, wallet.isPrimary)}
                        disabled={isLoading}
                        className="h-8 px-2 text-red-500 hover:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4 mt-6">
          <Card className={isDark ? "bg-gray-800 border-gray-700" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Account Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                    Email Verification
                  </p>
                  <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    {session?.user?.emailVerified ? "Your email is verified" : "Please verify your email"}
                  </p>
                </div>
                {session?.user?.emailVerified ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <Button variant="outline" size="sm">
                    Send Verification
                  </Button>
                )}
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                    Two-Factor Authentication
                  </p>
                  <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    Add an extra layer of security
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  <Shield className="h-4 w-4 mr-2" />
                  Enable 2FA
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className={`font-medium text-red-600`}>
                    Delete Account
                  </p>
                  <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    Permanently delete your account and all data
                  </p>
                </div>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )

  const LoadingSpinner = () => (
    <div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
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
        <DrawerContent className={`max-h-[95vh] ${isDark ? "bg-gray-900 border-gray-800" : ""}`}>
          <ModalHeader Component={DrawerHeader} />
          <div className="overflow-y-auto px-4 pb-6">
            {session?.user ? <AuthenticatedInterface /> : <GitHubSignIn />}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  // Desktop dialog
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-2xl max-h-[90vh] overflow-y-auto ${isDark ? "bg-gray-900 border-gray-800" : ""}`}>
        <ModalHeader Component={DialogHeader} />
        {session?.user ? <AuthenticatedInterface /> : <GitHubSignIn />}
      </DialogContent>
    </Dialog>
  )
} 