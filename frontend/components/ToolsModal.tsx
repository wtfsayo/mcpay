"use client"

import type React from "react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, X } from "lucide-react"
import { useTheme } from "@/context/ThemeContext"

// Define interfaces directly in this file as they are simple and specific to this component
interface MCPInputPropertySchema {
  type: string;
  description?: string;
  [key: string]: unknown;
}

interface MCPTool {
  name: string
  description?: string
  inputSchema: {
    type: string
    properties: Record<string, MCPInputPropertySchema>
  }
  annotations?: {
    title?: string
    readOnlyHint?: boolean
    destructiveHint?: boolean
    idempotentHint?: boolean
    openWorldHint?: boolean
  }
}

export interface MCPServer { // Exporting MCPServer as it's used in the props
  id: string
  name: string
  description: string
  url: string
  category: string
  tools: MCPTool[]
  icon: React.ReactNode
  verified?: boolean
}


export function ToolsModal({ server }: { server: MCPServer }) {
  const [isOpen, setIsOpen] = useState(false)
  const { isDark } = useTheme();

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={`w-full ${isDark ? "bg-slate-700 border-slate-600 text-white hover:bg-slate-600" : ""}`}
        onClick={() => setIsOpen(true)}
      >
        <Eye className="h-4 w-4 mr-2" />
        View Tools ({server.tools.length})
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsOpen(false)} />

          {/* Modal Content */}
          <div
            className={`relative ${isDark ? "bg-slate-800 text-white" : "bg-white"} rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col`}
          >
            {/* Header */}
            <div
              className={`flex items-center justify-between p-6 ${isDark ? "border-slate-700" : "border-slate-200"} border-b`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 ${isDark ? "bg-slate-700" : "bg-slate-100"} rounded-lg`}>{server.icon}</div>
                <div>
                  <h2 className="text-xl font-semibold">{server.name} - Tools</h2>
                  <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    Available tools and their parameters for this MCP server
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className={isDark ? "text-white hover:bg-slate-700" : ""}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {server.tools.map((tool, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 ${isDark ? "bg-slate-700 border-slate-600" : "bg-slate-50 border-slate-200"}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-lg">{tool.name}</h4>
                        {tool.annotations?.title && tool.annotations.title !== tool.name && (
                          <p className={`text-sm font-medium ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                            {tool.annotations.title}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {tool.annotations?.readOnlyHint && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${isDark ? "border-slate-500 text-slate-300" : ""}`}
                          >
                            Read-only
                          </Badge>
                        )}
                        {tool.annotations?.destructiveHint && (
                          <Badge variant="destructive" className="text-xs">
                            Destructive
                          </Badge>
                        )}
                        {tool.annotations?.idempotentHint && (
                          <Badge
                            variant="secondary"
                            className={`text-xs ${isDark ? "bg-slate-600 text-slate-200" : ""}`}
                          >
                            Idempotent
                          </Badge>
                        )}
                        {tool.annotations?.openWorldHint && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${isDark ? "border-slate-500 text-slate-300" : ""}`}
                          >
                            External
                          </Badge>
                        )}
                      </div>
                    </div>

                    {tool.description && (
                      <p className={`text-sm mb-3 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                        {tool.description}
                      </p>
                    )}

                    <div className="space-y-2">
                      <h5 className="font-medium text-sm">Parameters:</h5>
                      {Object.keys(tool.inputSchema.properties || {}).length > 0 ? (
                        <div className="space-y-2">
                          {Object.entries(tool.inputSchema.properties || {}).map(([key, value]: [string, MCPInputPropertySchema]) => (
                            <div
                              key={key}
                              className={`p-3 rounded border ${isDark ? "bg-slate-600 border-slate-500" : "bg-white border-slate-200"}`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <code className="font-mono text-sm font-medium">{key}</code>
                                  <span className={`ml-2 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                    ({value.type})
                                  </span>
                                </div>
                              </div>
                              {value.description && (
                                <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                                  {value.description}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className={`text-sm italic ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          No parameters required
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ToolsModal; 