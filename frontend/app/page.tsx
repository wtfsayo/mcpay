"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Search,
  ExternalLink,
  PenToolIcon as Tool,
  Database,
  Globe,
  Zap,
  FileText,
  Calculator,
  Calendar,
  Mail,
  Code,
  ImageIcon,
  Moon,
  Sun,
} from "lucide-react"
import { ToolsModal, MCPServer } from "@/components/ToolsModal"


const mcpServers: MCPServer[] = [
  {
    id: "zapier",
    name: "Zapier Actions",
    description: "Connect to 6000+ apps and automate workflows with Zapier's powerful integration platform.",
    url: "https://actions.zapier.com/mcp/•••••••/sse",
    category: "Automation",
    icon: <Zap className="h-6 w-6" />,
    verified: true,
    tools: [
      {
        name: "create_zap",
        description: "Create a new Zap automation",
        inputSchema: {
          type: "object",
          properties: {
            trigger_app: { type: "string", description: "The trigger application" },
            action_app: { type: "string", description: "The action application" },
            name: { type: "string", description: "Name for the Zap" },
          },
        },
        annotations: {
          title: "Create Zap",
          destructiveHint: false,
          idempotentHint: false,
        },
      },
      {
        name: "list_apps",
        description: "List available applications",
        inputSchema: {
          type: "object",
          properties: {
            category: { type: "string", description: "Filter by category" },
          },
        },
        annotations: {
          title: "List Apps",
          readOnlyHint: true,
        },
      },
      {
        name: "trigger_zap",
        description: "Manually trigger an existing Zap",
        inputSchema: {
          type: "object",
          properties: {
            zap_id: { type: "string", description: "The Zap ID to trigger" },
            data: { type: "object", description: "Input data for the trigger" },
          },
        },
        annotations: {
          title: "Trigger Zap",
          destructiveHint: false,
        },
      },
    ],
  },
  {
    id: "supabase",
    name: "Supabase",
    description: "Interact with your Supabase database, authentication, and storage directly through MCP.",
    url: "https://supabase.com/mcp/•••••••/sse",
    category: "Database",
    icon: <Database className="h-6 w-6" />,
    verified: true,
    tools: [
      {
        name: "query_table",
        description: "Query data from a table",
        inputSchema: {
          type: "object",
          properties: {
            table: { type: "string", description: "Table name" },
            select: { type: "string", description: "Columns to select" },
            where: { type: "object", description: "Where conditions" },
            limit: { type: "number", description: "Maximum number of rows" },
          },
        },
        annotations: {
          title: "Query Table",
          readOnlyHint: true,
        },
      },
      {
        name: "insert_row",
        description: "Insert a new row into a table",
        inputSchema: {
          type: "object",
          properties: {
            table: { type: "string", description: "Table name" },
            data: { type: "object", description: "Row data" },
          },
        },
        annotations: {
          title: "Insert Row",
          destructiveHint: false,
        },
      },
      {
        name: "update_row",
        description: "Update existing rows in a table",
        inputSchema: {
          type: "object",
          properties: {
            table: { type: "string", description: "Table name" },
            data: { type: "object", description: "Updated data" },
            where: { type: "object", description: "Where conditions" },
          },
        },
        annotations: {
          title: "Update Row",
          destructiveHint: true,
        },
      },
      {
        name: "delete_row",
        description: "Delete rows from a table",
        inputSchema: {
          type: "object",
          properties: {
            table: { type: "string", description: "Table name" },
            where: { type: "object", description: "Where conditions" },
          },
        },
        annotations: {
          title: "Delete Row",
          destructiveHint: true,
        },
      },
    ],
  },
  {
    id: "github",
    name: "GitHub",
    description: "Manage repositories, issues, pull requests, and more on GitHub through MCP integration.",
    url: "https://api.github.com/mcp/•••••••/sse",
    category: "Development",
    icon: <Code className="h-6 w-6" />,
    verified: true,
    tools: [
      {
        name: "create_issue",
        description: "Create a new issue in a repository",
        inputSchema: {
          type: "object",
          properties: {
            repo: { type: "string", description: "Repository name" },
            title: { type: "string", description: "Issue title" },
            body: { type: "string", description: "Issue description" },
            labels: { type: "array", description: "Issue labels" },
          },
        },
        annotations: {
          title: "Create Issue",
          destructiveHint: false,
        },
      },
      {
        name: "list_repos",
        description: "List user repositories",
        inputSchema: {
          type: "object",
          properties: {
            type: { type: "string", description: "Repository type (all, owner, member)" },
            sort: { type: "string", description: "Sort order" },
          },
        },
        annotations: {
          title: "List Repositories",
          readOnlyHint: true,
        },
      },
      {
        name: "create_pr",
        description: "Create a new pull request",
        inputSchema: {
          type: "object",
          properties: {
            repo: { type: "string", description: "Repository name" },
            title: { type: "string", description: "PR title" },
            head: { type: "string", description: "Head branch" },
            base: { type: "string", description: "Base branch" },
            body: { type: "string", description: "PR description" },
          },
        },
        annotations: {
          title: "Create Pull Request",
          destructiveHint: false,
        },
      },
    ],
  },
  {
    id: "notion",
    name: "Notion",
    description: "Create, read, and update Notion pages, databases, and blocks through MCP.",
    url: "https://api.notion.com/mcp/•••••••/sse",
    category: "Productivity",
    icon: <FileText className="h-6 w-6" />,
    tools: [
      {
        name: "create_page",
        description: "Create a new page in Notion",
        inputSchema: {
          type: "object",
          properties: {
            parent_id: { type: "string", description: "Parent page or database ID" },
            title: { type: "string", description: "Page title" },
            content: { type: "array", description: "Page content blocks" },
          },
        },
        annotations: {
          title: "Create Page",
          destructiveHint: false,
        },
      },
      {
        name: "query_database",
        description: "Query a Notion database",
        inputSchema: {
          type: "object",
          properties: {
            database_id: { type: "string", description: "Database ID" },
            filter: { type: "object", description: "Query filter" },
            sorts: { type: "array", description: "Sort criteria" },
          },
        },
        annotations: {
          title: "Query Database",
          readOnlyHint: true,
        },
      },
      {
        name: "update_page",
        description: "Update an existing page",
        inputSchema: {
          type: "object",
          properties: {
            page_id: { type: "string", description: "Page ID" },
            properties: { type: "object", description: "Page properties to update" },
          },
        },
        annotations: {
          title: "Update Page",
          destructiveHint: true,
        },
      },
    ],
  },
  {
    id: "calculator",
    name: "Calculator",
    description: "Perform mathematical calculations and solve equations with this computational MCP server.",
    url: "https://calc.mcp.dev/•••••••/sse",
    category: "Utilities",
    icon: <Calculator className="h-6 w-6" />,
    tools: [
      {
        name: "calculate",
        description: "Perform mathematical calculations",
        inputSchema: {
          type: "object",
          properties: {
            expression: { type: "string", description: "Mathematical expression to evaluate" },
          },
        },
        annotations: {
          title: "Calculate",
          readOnlyHint: true,
          idempotentHint: true,
        },
      },
      {
        name: "solve_equation",
        description: "Solve algebraic equations",
        inputSchema: {
          type: "object",
          properties: {
            equation: { type: "string", description: "Equation to solve" },
            variable: { type: "string", description: "Variable to solve for" },
          },
        },
        annotations: {
          title: "Solve Equation",
          readOnlyHint: true,
        },
      },
      {
        name: "plot_function",
        description: "Generate a plot of a mathematical function",
        inputSchema: {
          type: "object",
          properties: {
            function: { type: "string", description: "Function to plot" },
            range: { type: "object", description: "X and Y axis ranges" },
          },
        },
        annotations: {
          title: "Plot Function",
          readOnlyHint: true,
        },
      },
    ],
  },
  {
    id: "calendar",
    name: "Google Calendar",
    description: "Manage events, schedules, and calendar operations through Google Calendar MCP integration.",
    url: "https://calendar.google.com/mcp/•••••••/sse",
    category: "Productivity",
    icon: <Calendar className="h-6 w-6" />,
    verified: true,
    tools: [
      {
        name: "create_event",
        description: "Create a new calendar event",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Event title" },
            start_time: { type: "string", description: "Start time (ISO 8601)" },
            end_time: { type: "string", description: "End time (ISO 8601)" },
            description: { type: "string", description: "Event description" },
            attendees: { type: "array", description: "List of attendee emails" },
          },
        },
        annotations: {
          title: "Create Event",
          destructiveHint: false,
        },
      },
      {
        name: "list_events",
        description: "List upcoming events",
        inputSchema: {
          type: "object",
          properties: {
            calendar_id: { type: "string", description: "Calendar ID" },
            max_results: { type: "number", description: "Maximum number of events" },
            time_min: { type: "string", description: "Start time filter" },
          },
        },
        annotations: {
          title: "List Events",
          readOnlyHint: true,
        },
      },
      {
        name: "update_event",
        description: "Update an existing event",
        inputSchema: {
          type: "object",
          properties: {
            event_id: { type: "string", description: "Event ID" },
            updates: { type: "object", description: "Event updates" },
          },
        },
        annotations: {
          title: "Update Event",
          destructiveHint: true,
        },
      },
    ],
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    description: "Send emails, manage templates, and handle email marketing through SendGrid MCP.",
    url: "https://api.sendgrid.com/mcp/•••••••/sse",
    category: "Communication",
    icon: <Mail className="h-6 w-6" />,
    tools: [
      {
        name: "send_email",
        description: "Send an email",
        inputSchema: {
          type: "object",
          properties: {
            to: { type: "string", description: "Recipient email address" },
            subject: { type: "string", description: "Email subject" },
            content: { type: "string", description: "Email content" },
            from: { type: "string", description: "Sender email address" },
          },
        },
        annotations: {
          title: "Send Email",
          destructiveHint: false,
          openWorldHint: true,
        },
      },
      {
        name: "create_template",
        description: "Create an email template",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Template name" },
            subject: { type: "string", description: "Template subject" },
            html_content: { type: "string", description: "HTML content" },
          },
        },
        annotations: {
          title: "Create Template",
          destructiveHint: false,
        },
      },
      {
        name: "send_bulk_email",
        description: "Send bulk emails to multiple recipients",
        inputSchema: {
          type: "object",
          properties: {
            template_id: { type: "string", description: "Template ID" },
            recipients: { type: "array", description: "List of recipients" },
            personalizations: { type: "object", description: "Personalization data" },
          },
        },
        annotations: {
          title: "Send Bulk Email",
          destructiveHint: false,
          openWorldHint: true,
        },
      },
    ],
  },
  {
    id: "dalle",
    name: "DALL-E Image Generator",
    description: "Generate images using OpenAI's DALL-E model through MCP integration.",
    url: "https://api.openai.com/mcp/dalle/•••••••/sse",
    category: "AI/ML",
    icon: <ImageIcon className="h-6 w-6" />,
    tools: [
      {
        name: "generate_image",
        description: "Generate an image from text prompt",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "Image generation prompt" },
            size: { type: "string", description: "Image size (1024x1024, 512x512, etc.)" },
            quality: { type: "string", description: "Image quality (standard, hd)" },
            style: { type: "string", description: "Image style (vivid, natural)" },
          },
        },
        annotations: {
          title: "Generate Image",
          destructiveHint: false,
          openWorldHint: true,
        },
      },
      {
        name: "edit_image",
        description: "Edit an existing image",
        inputSchema: {
          type: "object",
          properties: {
            image_url: { type: "string", description: "URL of the image to edit" },
            prompt: { type: "string", description: "Edit instruction" },
            mask_url: { type: "string", description: "Mask image URL (optional)" },
          },
        },
        annotations: {
          title: "Edit Image",
          destructiveHint: false,
        },
      },
      {
        name: "create_variation",
        description: "Create variations of an existing image",
        inputSchema: {
          type: "object",
          properties: {
            image_url: { type: "string", description: "URL of the source image" },
            n: { type: "number", description: "Number of variations to generate" },
            size: { type: "string", description: "Size of generated variations" },
          },
        },
        annotations: {
          title: "Create Variation",
          destructiveHint: false,
        },
      },
    ],
  },
]

const categories = [
  "All",
  "Automation",
  "Database",
  "Development",
  "Productivity",
  "Utilities",
  "Communication",
  "AI/ML",
]

export default function MCPBrowser() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [isDark, setIsDark] = useState(false)

  // Load theme preference from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("mcp-browser-theme")
    if (savedTheme === "dark") {
      setIsDark(true)
    }
  }, [])

  // Save theme preference to localStorage when changed
  useEffect(() => {
    localStorage.setItem("mcp-browser-theme", isDark ? "dark" : "light")
  }, [isDark])

  const filteredServers = mcpServers.filter((server) => {
    const matchesSearch =
      server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      server.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === "All" || server.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const toggleTheme = () => {
    setIsDark(!isDark)
  }

  return (
    <div
      className={`min-h-screen p-6 transition-colors duration-200 ${
        isDark
          ? "bg-gradient-to-br from-black to-gray-900 text-white"
          : "bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900"
      }`}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">MCP Browser</h1>
          <p className={`text-lg max-w-3xl mx-auto ${isDark ? "text-gray-300" : "text-gray-600"}`}>
            Discover and explore Model Context Protocol servers. Connect AI models to external tools, data sources, and
            environments through standardized interfaces.
          </p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search
              className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${isDark ? "text-gray-400" : "text-gray-400"}`}
            />
            <Input
              placeholder="Search MCP servers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`pl-10 ${isDark ? "bg-gray-800 border-gray-700 text-white placeholder:text-gray-400" : ""}`}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                onClick={() => setSelectedCategory(category)}
                size="sm"
                className={
                  isDark
                    ? selectedCategory === category
                      ? "bg-gray-700 text-white border-gray-600 hover:bg-gray-600"
                      : "bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
                    : selectedCategory === category
                      ? "bg-gray-900 text-white hover:bg-gray-800"
                      : ""
                }
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className={isDark ? "text-gray-300" : "text-gray-600"}>
            {filteredServers.length} MCP server{filteredServers.length !== 1 ? "s" : ""} found
          </p>
        </div>

        {/* MCP Server Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServers.map((server) => (
            <Card
              key={server.id}
              className={`hover:shadow-lg transition-all duration-200 ${
                isDark ? "bg-gray-800 border-gray-700 text-white hover:shadow-black/50" : ""
              }`}
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-100"}`}>{server.icon}</div>
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {server.name}
                        {server.verified && (
                          <Badge variant="secondary" className={`text-xs ${isDark ? "bg-gray-600 text-gray-200" : ""}`}>
                            Verified
                          </Badge>
                        )}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className={`text-xs mt-1 ${isDark ? "border-gray-500 text-gray-300" : ""}`}
                      >
                        {server.category}
                      </Badge>
                    </div>
                  </div>
                </div>
                <CardDescription className={`text-sm leading-relaxed ${isDark ? "text-gray-300" : ""}`}>
                  {server.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* URL */}
                <div className="space-y-2">
                  <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>MCP URL</label>
                  <div className="flex items-center gap-2">
                    <code
                      className={`flex-1 text-xs p-2 rounded border font-mono break-all ${
                        isDark ? "bg-gray-700 border-gray-600 text-gray-300" : "bg-gray-100 border-gray-200"
                      }`}
                    >
                      {server.url}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(server.url)}
                      className={`shrink-0 ${isDark ? "bg-gray-700 border-gray-600 text-white hover:bg-gray-600" : ""}`}
                    >
                      Copy
                    </Button>
                  </div>
                </div>

                {/* Tools */}
                <div className="space-y-2">
                  <label
                    className={`text-sm font-medium flex items-center gap-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}
                  >
                    <Tool className="h-4 w-4" />
                    Available Tools
                  </label>
                  <ToolsModal server={server} isDark={isDark} />
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className={`flex-1 ${isDark ? "bg-gray-700 border-gray-600 text-white hover:bg-gray-600" : ""}`}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Connect
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredServers.length === 0 && (
          <div className="text-center py-12">
            <Globe className={`h-12 w-12 mx-auto mb-4 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
            <h3 className="text-lg font-medium mb-2">No MCP servers found</h3>
            <p className={isDark ? "text-gray-400" : "text-gray-600"}>
              Try adjusting your search terms or category filter.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className={`mt-12 text-center text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
          <div className="flex items-center justify-center gap-4 mb-4">
            <p>
              Learn more about Model Context Protocol at{" "}
              <a
                href="https://modelcontextprotocol.io"
                className={`hover:underline ${isDark ? "text-gray-300" : "text-gray-600"}`}
              >
                modelcontextprotocol.io
              </a>
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className={`flex items-center gap-2 ${isDark ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"}`}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {isDark ? "Light" : "Dark"} Mode
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
