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
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTheme } from "@/context/ThemeContext"
import { signIn, signOut, signUp, useSession } from "@/lib/auth"
import { openExplorer } from "@/lib/blockscout"
import type { UserWallet } from "@/lib/types"
import { api } from "@/lib/utils"
import {
  AlertCircle,
  CheckCircle,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
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
import React, { useCallback, useEffect, useState } from "react"
import { useAccount, useDisconnect } from "wagmi"
import { ConnectButton } from "./connect-button"

interface AccountModalProps {
  isOpen: boolean
  onClose: () => void
  defaultTab?: 'profile' | 'wallets' | 'settings'
}

type AuthView = 'signin' | 'signup' | 'authenticated'

export function AccountModal({ isOpen, onClose, defaultTab = 'profile' }: AccountModalProps) {
  const { isDark } = useTheme()
  const { data: session, isPending: sessionLoading } = useSession()
  const { address: connectedWallet, isConnected } = useAccount()

  const { disconnect } = useDisconnect()

  const [authView, setAuthView] = useState<AuthView>('signin')
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [userWallets, setUserWallets] = useState<UserWallet[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Form states - using refs to prevent re-render issues
  const [signInForm, setSignInForm] = useState({ email: '', password: '' })
  const [signUpForm, setSignUpForm] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    confirmPassword: '' 
  })

  // Fix input focus issue by using callbacks
  const updateSignInForm = useCallback((field: string, value: string) => {
    setSignInForm(prev => ({ ...prev, [field]: value }))
  }, [])

  const updateSignUpForm = useCallback((field: string, value: string) => {
    setSignUpForm(prev => ({ ...prev, [field]: value }))
  }, [])

  // Determine current view based on session
  useEffect(() => {
    if (session?.user) {
      setAuthView('authenticated')
    } else if (authView === 'authenticated') {
      setAuthView('signin')
    }
  }, [session, authView])

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

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const result = await signIn.email({
        email: signInForm.email,
        password: signInForm.password,
      })

      if (result.error) {
        setError(result.error.message || "Failed to sign in")
      } else {
        setSignInForm({ email: '', password: '' })
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to sign in")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    if (signUpForm.password !== signUpForm.confirmPassword) {
      setError("Passwords don't match")
      setIsLoading(false)
      return
    }

    try {
      const result = await signUp.email({
        email: signUpForm.email,
        password: signUpForm.password,
        name: signUpForm.name,
      })

      if (result.error) {
        setError(result.error.message || "Failed to create account")
      } else {
        setSignUpForm({ name: '', email: '', password: '', confirmPassword: '' })
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to create account")
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
        blockchain: 'ethereum', // Can be enhanced to detect blockchain
        walletType: 'external',
        provider: 'metamask', // Can be enhanced to detect provider
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  // Auth Forms Component
  const AuthForms = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
          isDark ? "bg-gray-800" : "bg-gray-100"
        }`}>
          <User className={`h-8 w-8 ${isDark ? "text-gray-300" : "text-gray-600"}`} />
        </div>
        <h2 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
          {authView === 'signin' ? "Welcome back" : "Create your account"}
        </h2>
        <p className={`text-sm mt-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
          {authView === 'signin' 
            ? "Sign in to your MCPay account" 
            : "Get started with MCPay today"
          }
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

      <Tabs value={authView} onValueChange={(v) => setAuthView(v as AuthView)} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="signin">Sign In</TabsTrigger>
          <TabsTrigger value="signup">Sign Up</TabsTrigger>
        </TabsList>

        <TabsContent value="signin" className="space-y-4 mt-6">
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className={`text-sm font-medium block mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Email
              </label>
              <Input
                type="email"
                placeholder="Enter your email"
                value={signInForm.email}
                onChange={(e) => updateSignInForm('email', e.target.value)}
                required
                className={isDark ? "bg-gray-800 border-gray-700" : ""}
              />
            </div>
            <div>
              <label className={`text-sm font-medium block mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={signInForm.password}
                  onChange={(e) => updateSignInForm('password', e.target.value)}
                  required
                  className={`pr-10 ${isDark ? "bg-gray-800 border-gray-700" : ""}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className={`w-full border-t ${isDark ? "border-gray-700" : "border-gray-300"}`} />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className={`px-2 ${isDark ? "bg-gray-900 text-gray-400" : "bg-white text-gray-500"}`}>
                Or continue with
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => signIn.social({ provider: "github", callbackURL: "http://localhost:3232" })}
            disabled={isLoading}
            className="w-full"
          >
            <Github className="h-4 w-4 mr-2" />
            GitHub
          </Button>
        </TabsContent>

        <TabsContent value="signup" className="space-y-4 mt-6">
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className={`text-sm font-medium block mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Name
              </label>
              <Input
                type="text"
                placeholder="Enter your full name"
                value={signUpForm.name}
                onChange={(e) => updateSignUpForm('name', e.target.value)}
                required
                className={isDark ? "bg-gray-800 border-gray-700" : ""}
              />
            </div>
            <div>
              <label className={`text-sm font-medium block mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Email
              </label>
              <Input
                type="email"
                placeholder="Enter your email"
                value={signUpForm.email}
                onChange={(e) => updateSignUpForm('email', e.target.value)}
                required
                className={isDark ? "bg-gray-800 border-gray-700" : ""}
              />
            </div>
            <div>
              <label className={`text-sm font-medium block mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={signUpForm.password}
                  onChange={(e) => updateSignUpForm('password', e.target.value)}
                  required
                  className={`pr-10 ${isDark ? "bg-gray-800 border-gray-700" : ""}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div>
              <label className={`text-sm font-medium block mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Confirm Password
              </label>
              <Input
                type="password"
                placeholder="Confirm your password"
                value={signUpForm.confirmPassword}
                onChange={(e) => updateSignUpForm('confirmPassword', e.target.value)}
                required
                className={isDark ? "bg-gray-800 border-gray-700" : ""}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className={`w-full border-t ${isDark ? "border-gray-700" : "border-gray-300"}`} />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className={`px-2 ${isDark ? "bg-gray-900 text-gray-400" : "bg-white text-gray-500"}`}>
                Or continue with
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => signIn.social({ provider: "github" })}
            disabled={isLoading}
            className="w-full"
          >
            <Github className="h-4 w-4 mr-2" />
            GitHub
          </Button>
        </TabsContent>
      </Tabs>
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
              <div>
                <label className={`text-sm font-medium block mb-1 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  User ID
                </label>
                <div className="flex items-center gap-2">
                  <code className={`text-xs px-2 py-1 rounded ${isDark ? "bg-gray-700" : "bg-gray-100"}`}>
                    {session?.user?.id}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(session?.user?.id || "")}
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
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
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">
          {session?.user ? "Account" : "Sign In"}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
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
            {session?.user ? <AuthenticatedInterface /> : <AuthForms />}
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
        {session?.user ? <AuthenticatedInterface /> : <AuthForms />}
      </DialogContent>
    </Dialog>
  )
} 