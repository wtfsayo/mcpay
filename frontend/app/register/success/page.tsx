"use client"

import type React from "react"
import { useState, useEffect, Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, Server, Calendar, User, Globe, ExternalLink, ChevronDown, ChevronRight, Shield, Database, Hash, AlertCircle } from "lucide-react"
import { useTheme } from "@/context/ThemeContext"
import { openBlockscout } from "@/lib/blockscout"
import { useSearchParams } from "next/navigation"

// Mock data - fallback if no query params are provided
const mockRegistrationResult = {
  "id": "4233460e-8520-4821-809d-027ba19fc809",
  "serverId": "cf9fc475-321f-455a-9813-96e88851497f",
  "mcpOrigin": "https://mcp.bitte.ai/mcp?agentId=near-cow-agent.vercel.app",
  "creatorId": "bdbc30be-a671-4b7e-86c4-c9402ed7547d",
  "receiverAddress": "0x58E165Ae2dcEAc87481D56009Af5FBf5B9887aB8",
  "requireAuth": false,
  "authHeaders": null,
  "createdAt": "2025-06-11T16:52:21.606Z",
  "updatedAt": "2025-06-11T16:52:21.606Z",
  "status": "active",
  "name": "MCP ToolBox",
  "description": "MCP ToolBox is a versatile MCP server equipped with essential tools for seamless token management. Utilizing features like 'check-health' to ensure system reliability, 'get-balances' to retrieve wallet token balances, 'swap' to calculate fees and prices for orders, and 'erc20-transfer' to facilitate encoded ERC20 transactions as MetaTransactions, this server is designed to streamline your cryptocurrency operations efficiently.",
  "metadata": {
    "timestamp": "2025-06-11T16:52:16.726Z",
    "toolsCount": 4,
    "registeredFromUI": true,
    "monetizedToolsCount": 4
  }
}

function RegisterSuccessContent() {
  const { isDark } = useTheme()
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false)
  const [registrationData, setRegistrationData] = useState<any>(null)
  const [dataError, setDataError] = useState<string>("")
  const searchParams = useSearchParams()

  // Load registration data from query params or fallback to mock
  useEffect(() => {
    try {
      const dataParam = searchParams.get('data')
      if (dataParam) {
        const decodedData = decodeURIComponent(dataParam)
        const parsedData = JSON.parse(decodedData)
        setRegistrationData(parsedData)
      } else {
        // No data parameter, use mock data and show warning
        setRegistrationData(mockRegistrationResult)
        setDataError("No registration data found in URL. Showing example data.")
      }
    } catch (error) {
      console.error("Failed to parse registration data:", error)
      setRegistrationData(mockRegistrationResult)
      setDataError("Failed to load registration data. Showing example data.")
    }
  }, [searchParams])

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    })
  }

  // Extract hostname from URL for display
  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  // Don't render anything until we have data
  if (!registrationData) {
    return (
      <div className="min-h-screen p-6 md:p-8 lg:p-12 flex items-center justify-center">
        <Card className={`${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} shadow-lg`}>
          <CardContent className="pt-8 pb-8 px-6 md:px-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className={`${isDark ? "text-gray-300" : "text-gray-600"}`}>Loading registration data...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 md:p-8 lg:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Data Error Warning */}
        {dataError && (
          <Card className={`${isDark ? "bg-amber-900/20 border-amber-800" : "bg-amber-50 border-amber-200"} shadow-lg`}>
            <CardContent className="pt-4 pb-4 px-6 md:px-8">
              <div className="flex items-center gap-3">
                <AlertCircle className={`h-5 w-5 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
                <p className={`text-sm ${isDark ? "text-amber-200" : "text-amber-800"}`}>
                  {dataError}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success Header */}
        <Card className={`${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} shadow-lg`}>
          <CardContent className="pt-12 pb-8 px-6 md:px-8">
            <div className="text-center space-y-6">
              <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full ${isDark ? "bg-green-500/20" : "bg-green-50"} mb-4`}>
                <CheckCircle className={`h-12 w-12 ${isDark ? "text-green-400" : "text-green-600"}`} />
              </div>
              
              <div className="space-y-3">
                <h1 className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                  Registration Successful!
                </h1>
                <p className={`text-lg ${isDark ? "text-gray-300" : "text-gray-600"} max-w-2xl mx-auto`}>
                  Your MCP server <span className="font-semibold text-blue-600">{registrationData.name}</span> has been registered successfully and is now available on the platform.
                </p>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 max-w-md mx-auto">
                <div className={`p-4 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-50"}`}>
                  <div className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                    {registrationData.metadata.toolsCount}
                  </div>
                  <div className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    Total Tools
                  </div>
                </div>
                <div className={`p-4 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-50"}`}>
                  <div className="text-2xl font-bold text-green-600">
                    {registrationData.metadata.monetizedToolsCount}
                  </div>
                  <div className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    Monetized
                  </div>
                </div>
                <div className={`p-4 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-50"}`}>
                  <div className={`text-2xl font-bold ${registrationData.status === 'active' ? 'text-green-600' : 'text-amber-600'}`}>
                    {registrationData.status.toUpperCase()}
                  </div>
                  <div className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    Status
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Server Information */}
        <Card className={`${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} shadow-lg`}>
          <CardHeader className="px-6 md:px-8 pt-8 pb-6">
            <CardTitle className={`flex items-center gap-3 text-xl ${isDark ? "text-white" : "text-gray-900"}`}>
              <Server className="h-6 w-6" />
              Server Information
            </CardTitle>
            <CardDescription className={`text-base mt-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              Key details about your registered MCP server
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 md:px-8 pb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Basic Info */}
              <div className="space-y-6">
                <div>
                  <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} block mb-2`}>
                    Server Name
                  </label>
                  <div className={`p-3 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-50"} text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
                    {registrationData.name}
                  </div>
                </div>

                <div>
                  <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} block mb-2`}>
                    MCP Origin
                  </label>
                  <div className={`p-3 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-50"} flex items-center justify-between gap-2`}>
                    <span className={`text-sm font-mono ${isDark ? "text-gray-300" : "text-gray-600"} break-all`}>
                      {getHostname(registrationData.mcpOrigin)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(registrationData.mcpOrigin, '_blank')}
                      className={`p-1 h-auto flex-shrink-0 ${isDark ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"}`}
                      title="Open MCP URL"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} block mb-2`}>
                    Receiver Address
                  </label>
                  <div className={`p-3 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-50"} flex items-center justify-between gap-2`}>
                    <span className={`text-sm font-mono ${isDark ? "text-gray-300" : "text-gray-600"} break-all`}>
                      {registrationData.receiverAddress}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openBlockscout(registrationData.receiverAddress)}
                      className={`p-1 h-auto flex-shrink-0 ${isDark ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"}`}
                      title="View on Blockscout"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Status & Meta */}
              <div className="space-y-6">
                <div>
                  <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} block mb-2`}>
                    Registration Date
                  </label>
                  <div className={`p-3 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-50"} flex items-center gap-3`}>
                    <Calendar className={`h-4 w-4 ${isDark ? "text-gray-400" : "text-gray-600"}`} />
                    <span className={`text-sm ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                      {formatDate(registrationData.createdAt)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} block mb-2`}>
                    Authentication
                  </label>
                  <div className={`p-3 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-50"} flex items-center gap-3`}>
                    <Shield className={`h-4 w-4 ${registrationData.requireAuth ? 'text-green-500' : isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                    <span className={`text-sm ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                      {registrationData.requireAuth ? 'Required' : 'Not Required'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} block mb-2`}>
                    Registration Source
                  </label>
                  <div className={`p-3 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-50"} flex items-center gap-3`}>
                    <Globe className={`h-4 w-4 ${isDark ? "text-gray-400" : "text-gray-600"}`} />
                    <span className={`text-sm ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                      {registrationData.metadata.registeredFromUI ? 'Web Interface' : 'API'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mt-6">
              <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} block mb-2`}>
                Description
              </label>
              <div className={`p-4 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-50"} text-sm ${isDark ? "text-gray-300" : "text-gray-600"} leading-relaxed`}>
                {registrationData.description}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Information - Collapsible */}
        <Card className={`${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} shadow-lg`}>
          <CardHeader className="px-6 md:px-8 pt-8 pb-4">
            <button
              onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
              className={`flex items-center justify-between w-full text-left group p-4 -m-4 rounded-lg transition-all duration-200 hover:${isDark ? "bg-gray-700/50" : "bg-gray-50"} focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-100"}`}>
                  <Database className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <CardTitle className={`text-xl font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                    Technical Details
                  </CardTitle>
                  <p className={`text-sm mt-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    Server IDs, timestamps, and metadata
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-medium ${isDark ? "text-gray-400" : "text-gray-500"} group-hover:${isDark ? "text-gray-300" : "text-gray-700"} transition-colors duration-200`}>
                  {isDetailsExpanded ? "Hide" : "Show"}
                </span>
                <div className={`p-2 rounded-full transition-all duration-200 group-hover:${isDark ? "bg-gray-600" : "bg-gray-100"}`}>
                  {isDetailsExpanded ? (
                    <ChevronDown className={`h-4 w-4 transition-all duration-300 ${isDark ? "text-gray-400" : "text-gray-500"}`} />
                  ) : (
                    <ChevronRight className={`h-4 w-4 transition-all duration-300 ${isDark ? "text-gray-400" : "text-gray-500"}`} />
                  )}
                </div>
              </div>
            </button>
          </CardHeader>
          
          <div className={`overflow-hidden transition-all duration-500 ease-out ${
            isDetailsExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
          }`}>
            <div className={`px-6 md:px-8 pb-8 transition-all duration-300 ${isDetailsExpanded ? "translate-y-0" : "-translate-y-2"}`}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} flex items-center gap-2 mb-2`}>
                      <Hash className="h-4 w-4" />
                      Registration ID
                    </label>
                    <div className={`p-3 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-50"} text-sm font-mono ${isDark ? "text-gray-300" : "text-gray-600"} break-all`}>
                      {registrationData.id}
                    </div>
                  </div>

                  <div>
                    <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} flex items-center gap-2 mb-2`}>
                      <Server className="h-4 w-4" />
                      Server ID
                    </label>
                    <div className={`p-3 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-50"} text-sm font-mono ${isDark ? "text-gray-300" : "text-gray-600"} break-all`}>
                      {registrationData.serverId}
                    </div>
                  </div>

                  <div>
                    <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} flex items-center gap-2 mb-2`}>
                      <User className="h-4 w-4" />
                      Creator ID
                    </label>
                    <div className={`p-3 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-50"} text-sm font-mono ${isDark ? "text-gray-300" : "text-gray-600"} break-all`}>
                      {registrationData.creatorId}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} flex items-center gap-2 mb-2`}>
                      <Calendar className="h-4 w-4" />
                      Last Updated
                    </label>
                    <div className={`p-3 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-50"} text-sm ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                      {formatDate(registrationData.updatedAt)}
                    </div>
                  </div>

                  <div>
                    <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} flex items-center gap-2 mb-2`}>
                      <Calendar className="h-4 w-4" />
                      Metadata Timestamp
                    </label>
                    <div className={`p-3 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-50"} text-sm ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                      {formatDate(registrationData.metadata.timestamp)}
                    </div>
                  </div>

                  <div>
                    <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} block mb-2`}>
                      Full MCP Origin URL
                    </label>
                    <div className={`p-3 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-50"} text-sm font-mono ${isDark ? "text-gray-300" : "text-gray-600"} break-all`}>
                      {registrationData.mcpOrigin}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={() => window.location.href = '/register'}
            className="px-8 py-3"
          >
            Register Another Server
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.href = '/'}
            className="px-8 py-3"
          >
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen p-6 md:p-8 lg:p-12 flex items-center justify-center">
      <Card className="bg-white border-gray-200 shadow-lg">
        <CardContent className="pt-8 pb-8 px-6 md:px-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function RegisterSuccessPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <RegisterSuccessContent />
    </Suspense>
  )
}
