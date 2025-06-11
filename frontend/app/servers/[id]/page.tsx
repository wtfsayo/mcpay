"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useTheme } from "@/context/ThemeContext"
import { openBlockscout } from "@/lib/blockscout"
import { api } from "@/lib/utils"
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle,
  Clock,
  Copy,
  DollarSign,
  ExternalLink,
  Globe,
  Loader2,
  Shield,
  Users,
  Wrench,
  XCircle
} from "lucide-react"
import Image from "next/image"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"

// Types based on the API response structure
interface ServerData {
  id: string
  serverId: string
  name: string
  mcpOrigin: string
  receiverAddress: string
  description: string
  metadata?: Record<string, unknown>
  status: string
  createdAt: string
  updatedAt: string
  creator: {
    id: string
    walletAddress: string
    displayName: string
    avatarUrl?: string
  }
  tools: Array<{
    id: string
    name: string
    description: string
    inputSchema: Record<string, unknown>
    isMonetized: boolean
    payment?: Record<string, unknown>
    status: string
    metadata?: Record<string, unknown>
    createdAt: string
    updatedAt: string
    pricing: Array<{
      id: string
      price: string
      currency: string
      network: string
      assetAddress: string
      active: boolean
      createdAt: string
    }>
    payments: Array<{
      id: string
      amount: string
      currency: string
      network: string
      status: string
      createdAt: string
      settledAt?: string
      transactionHash?: string
      user: {
        id: string
        walletAddress: string
        displayName: string
      }
    }>
    usage: Array<{
      id: string
      timestamp: string
      responseStatus: string
      executionTimeMs?: number
      user: {
        id: string
        walletAddress: string
        displayName: string
      }
    }>
    proofs: Array<{
      id: string
      isConsistent: boolean
      confidenceScore: string
      status: string
      verificationType: string
      createdAt: string
      webProofPresentation?: string
      user: {
        id: string
        walletAddress: string
        displayName: string
      }
    }>
  }>
  analytics: Array<{
    id: string
    date: string
    totalRequests: number
    totalRevenue: string
    uniqueUsers: number
    avgResponseTime?: string
    toolUsage: Record<string, number>
    errorCount: number
  }>
  ownership: Array<{
    id: string
    role: string
    createdAt: string
    active: boolean
    user: {
      id: string
      walletAddress: string
      displayName: string
      avatarUrl?: string
    }
    grantedByUser?: {
      id: string
      walletAddress: string
      displayName: string
    }
  }>
  proofs: Array<{
    id: string
    isConsistent: boolean
    confidenceScore: string
    status: string
    verificationType: string
    createdAt: string
    webProofPresentation?: string
    tool: {
      id: string
      name: string
    }
    user: {
      id: string
      walletAddress: string
      displayName: string
    }
  }>
  stats: {
    totalTools: number
    monetizedTools: number
    totalPayments: number
    totalRevenue: number
    totalUsage: number
    totalProofs: number
    consistentProofs: number
    proofsWithWebProof: number
    uniqueUsers: number
    avgResponseTime: number
    reputationScore: number
    lastActivity: string
  }
}

export default function ServerDashboard() {
  const params = useParams()
  const serverId = params.id as string
  const [serverData, setServerData] = useState<ServerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isDark } = useTheme()

  useEffect(() => {
    const fetchServerData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const data = await api.getServer(serverId)
        setServerData(data)
      } catch (err) {
        console.error('Error fetching server data:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch server data')
      } finally {
        setLoading(false)
      }
    }

    if (serverId) {
      fetchServerData()
    }
  }, [serverId])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const formatCurrency = (amount: string | number, currency: string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return `${num.toFixed(6)} ${currency}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getReputationColor = (score: number) => {
    if (score >= 0.8) return isDark ? "text-green-400" : "text-green-600"
    if (score >= 0.6) return isDark ? "text-yellow-400" : "text-yellow-600"
    return isDark ? "text-red-400" : "text-red-600"
  }

  if (loading) {
    return (
      <div className={`min-h-screen p-6 transition-colors duration-200 ${
        isDark ? "bg-gradient-to-br from-black to-gray-900 text-white" : "bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900"
      }`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className={isDark ? "text-gray-300" : "text-gray-600"}>Loading server dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`min-h-screen p-6 transition-colors duration-200 ${
        isDark ? "bg-gradient-to-br from-black to-gray-900 text-white" : "bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900"
      }`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertCircle className={`h-12 w-12 mx-auto mb-4 ${isDark ? "text-red-400" : "text-red-500"}`} />
              <h3 className="text-lg font-medium mb-2">Failed to load server</h3>
              <p className={`mb-4 ${isDark ? "text-gray-400" : "text-gray-600"}`}>{error}</p>
              <Button 
                onClick={() => window.location.reload()}
                className={isDark ? "bg-gray-700 text-white hover:bg-gray-600" : ""}
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!serverData) return null

  return (
    <div className={`min-h-screen p-6 transition-colors duration-200 ${
      isDark ? "bg-gradient-to-br from-black to-gray-900 text-white" : "bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900"
    }`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{serverData.name}</h1>
              <p className={`text-lg max-w-2xl ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                {serverData.description}
              </p>
            </div>
            <Badge 
              variant={serverData.status === 'active' ? 'default' : 'secondary'} 
              className={`text-sm ${isDark ? "bg-gray-600 text-gray-200" : ""}`}
            >
              {serverData.status}
            </Badge>
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <span className={isDark ? "text-gray-400" : "text-gray-500"}>
              Created: {formatDate(serverData.createdAt)}
            </span>
            <span className={isDark ? "text-gray-400" : "text-gray-500"}>
              Last Activity: {formatDate(serverData.stats.lastActivity)}
            </span>
            <span className={`font-medium ${getReputationColor(serverData.stats.reputationScore)}`}>
              Reputation: {(serverData.stats.reputationScore * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className={isDark ? "bg-gray-800 border-gray-700" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${serverData.stats.totalRevenue.toFixed(4)}</div>
              <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                From {serverData.stats.totalPayments} payments
              </p>
            </CardContent>
          </Card>

          <Card className={isDark ? "bg-gray-800 border-gray-700" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{serverData.stats.totalUsage.toLocaleString()}</div>
              <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Avg response: {serverData.stats.avgResponseTime.toFixed(0)}ms
              </p>
            </CardContent>
          </Card>

          <Card className={isDark ? "bg-gray-800 border-gray-700" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{serverData.stats.uniqueUsers}</div>
              <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Active users
              </p>
            </CardContent>
          </Card>

          <Card className={isDark ? "bg-gray-800 border-gray-700" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verification Score</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getReputationColor(serverData.stats.reputationScore)}`}>
                {(serverData.stats.reputationScore * 100).toFixed(1)}%
              </div>
              <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                {serverData.stats.consistentProofs}/{serverData.stats.totalProofs} consistent
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Server Connection */}
        <Card className={`mb-8 ${isDark ? "bg-gray-800 border-gray-700" : ""}`}>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Connection & Owner</CardTitle>
            <CardDescription>Essential information for connecting to and trusting this server</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Payment Address */}
            <div>
              <label className={`text-sm font-medium block mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Payment Address
              </label>
              <div className="flex items-center gap-2">
                <code className={`flex-1 text-sm p-3 rounded-md font-mono ${
                  isDark ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-800"
                }`}>
                  {serverData.receiverAddress}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(serverData.receiverAddress)}
                  title="Copy address"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openBlockscout(serverData.receiverAddress)}
                  title="View on Blockscout"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Owner & Server ID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={`text-sm font-medium block mb-3 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  Server Owner
                </label>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isDark ? "bg-gray-700" : "bg-gray-100"
                  }`}>
                    {serverData.creator.avatarUrl ? (
                      <img 
                        src={serverData.creator.avatarUrl} 
                        alt={serverData.creator.displayName}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <Users className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{serverData.creator.displayName}</div>
                    <button
                      onClick={() => openBlockscout(serverData.creator.walletAddress)}
                      className={`text-xs hover:underline ${isDark ? "text-gray-400 hover:text-gray-300" : "text-gray-600 hover:text-gray-700"}`}
                    >
                      {serverData.creator.walletAddress.slice(0, 6)}...{serverData.creator.walletAddress.slice(-4)}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className={`text-sm font-medium block mb-3 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  Server ID
                </label>
                <code className={`text-sm font-mono block p-3 rounded-md ${
                  isDark ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-800"
                }`}>
                  {serverData.serverId}
                </code>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tools */}
        <Card className={`mb-8 ${isDark ? "bg-gray-800 border-gray-700" : ""}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Tools ({serverData.stats.totalTools})
            </CardTitle>
            <CardDescription>
              {serverData.stats.monetizedTools} monetized • {serverData.stats.totalTools - serverData.stats.monetizedTools} free
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Tool</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead className="text-right">Verification</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serverData.tools.map((tool) => (
                    <TableRow key={tool.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-medium text-sm">{tool.name}</div>
                          <div className={`text-xs mt-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                            {tool.description.length > 60 ? `${tool.description.substring(0, 60)}...` : tool.description}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {tool.isMonetized ? (
                          <Badge variant="secondary" className={`text-xs ${isDark ? "bg-gray-600 text-gray-200" : ""}`}>
                            Paid
                          </Badge>
                        ) : (
                          <Badge variant="outline" className={`text-xs ${isDark ? "border-gray-500 text-gray-300" : ""}`}>
                            Free
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {tool.pricing.length > 0 ? (
                          formatCurrency(tool.pricing[0].price, tool.pricing[0].currency)
                        ) : (
                          <span className={isDark ? "text-gray-400" : "text-gray-500"}>Free</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{tool.usage.length} uses</div>
                          <div className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                            {tool.payments.length} payments
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {tool.proofs.length > 0 ? (
                          <div className="flex items-center justify-end gap-2 text-xs">
                            <div className={`flex items-center gap-1 ${
                              tool.proofs.filter(p => p.isConsistent).length > 0 ? "text-green-500" : "text-red-500"
                            }`}>
                              {tool.proofs.filter(p => p.isConsistent).length > 0 ? (
                                <CheckCircle className="h-3 w-3" />
                              ) : (
                                <XCircle className="h-3 w-3" />
                              )}
                              <span>
                                {tool.proofs.filter(p => p.isConsistent).length}/{tool.proofs.length}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                            No proofs
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Analytics and Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Analytics Chart */}
          <Card className={isDark ? "bg-gray-800 border-gray-700" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Analytics (Last 30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {serverData.analytics.slice(0, 7).map((day, index) => (
                  <div key={day.id} className="flex items-center justify-between">
                    <span className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                      {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <div className="flex items-center gap-4 text-sm">
                      <span>{day.totalRequests} requests</span>
                      <span className="text-green-500">${parseFloat(day.totalRevenue).toFixed(2)}</span>
                      <span>{day.uniqueUsers} users</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Proofs */}
          <Card className={isDark ? "bg-gray-800 border-gray-700" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Recent Proofs
                <Badge variant="outline" className={`ml-2 text-xs ${isDark ? "border-gray-500 text-gray-300" : ""}`}>
                  Powered by <Image src="/vlayer-logo.svg" alt="vLayer" width={60} height={20} className="inline ml-1" />
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {serverData.proofs.slice(0, 5).map((proof) => (
                  <div key={proof.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {proof.isConsistent ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{proof.tool.name}</p>
                        <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                          <button
                            onClick={() => openBlockscout(proof.user.walletAddress)}
                            className={`hover:underline ${isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"}`}
                          >
                            {proof.user.displayName}
                          </button>
                          {" • "}
                          {formatDate(proof.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {(parseFloat(proof.confidenceScore) * 100).toFixed(1)}%
                      </p>
                      {proof.webProofPresentation && (
                        <Badge variant="outline" className={`text-xs ${isDark ? "border-gray-500 text-gray-300" : ""}`}>
                          Web Proof
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Payments */}
        <Card className={isDark ? "bg-gray-800 border-gray-700" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Recent Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {serverData.tools.flatMap(tool => tool.payments).slice(0, 10).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      payment.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
                    }`}>
                      {payment.status === 'completed' ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <Clock className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{formatCurrency(payment.amount, payment.currency)}</p>
                      <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                        <button
                          onClick={() => openBlockscout(payment.user.walletAddress)}
                          className={`hover:underline ${isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"}`}
                        >
                          {payment.user.displayName}
                        </button>
                        {" • "}
                        {formatDate(payment.createdAt)}
                      </p>
                    </div>
                  </div>
                  <Badge variant={payment.status === 'completed' ? 'default' : 'secondary'}>
                    {payment.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
