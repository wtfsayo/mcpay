import { getMcpPrompts } from '@/lib/gateway/inspect-mcp';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { convertToModelMessages, experimental_createMCPClient as createMCPClient, streamText, UIMessage, ToolSet } from 'ai';
import { NextResponse } from 'next/server';
import { createClient } from '@vercel/kv';
import { createHash } from 'crypto';
import { getKVConfig } from '@/lib/gateway/env';

// Type definitions for MCP data
interface McpPrompt {
  name: string;
  description?: string;
  content: string;
  messages: unknown[];
}

interface McpPromptsResponse {
  prompts: McpPrompt[];
}

interface CachedMcpData {
  prompts: McpPromptsResponse;
  tools: ToolSet;
}

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const CACHE_TTL = 300; // 5 minutes in seconds

// Initialize KV client with configuration from env.ts
const kvConfig = getKVConfig();
const kv = createClient({
  url: kvConfig.restApiUrl,
  token: kvConfig.restApiToken,
});

function getCacheKey(mcpUrl: string): string {
  // Create a stable cache key from the URL
  const hash = createHash('md5').update(mcpUrl).digest('hex');
  return `mcp_data:${hash}`;
}

async function getCachedMcpData(mcpUrl: string): Promise<CachedMcpData> {
  const promptsCacheKey = `${getCacheKey(mcpUrl)}_prompts`;
  
  try {
    // Try to get cached prompts (tools can't be serialized properly)
    const cachedPrompts = await kv.get(promptsCacheKey);
    
    if (cachedPrompts) {
      console.log('Chat API: Using cached prompts from KV, fetching fresh tools');
      
      // Get fresh tools (they contain complex objects that can't be cached)
      const client = await createMCPClient({
        transport: new StreamableHTTPClientTransport(new URL(mcpUrl)),
      });
      const tools = await client.tools();
      
      return { 
        prompts: cachedPrompts as McpPromptsResponse, 
        tools 
      };
    }
    
    console.log('Chat API: Fetching fresh MCP data');
    
    // Fetch fresh data
    const [prompts, client] = await Promise.all([
      getMcpPrompts(mcpUrl),
      createMCPClient({
        transport: new StreamableHTTPClientTransport(new URL(mcpUrl)),
      })
    ]);
    
    const tools = await client.tools();
    
    // Only cache prompts (tools contain non-serializable objects)
    await kv.set(promptsCacheKey, prompts, { ex: CACHE_TTL });
    
    console.log(`Chat API: Cached prompts for ${CACHE_TTL} seconds`);
    
    return { prompts, tools };
  } catch (error) {
    console.error('Chat API: KV cache error, falling back to fresh data:', error);
    
    // Fallback to fresh data if cache fails
    const [prompts, client] = await Promise.all([
      getMcpPrompts(mcpUrl),
      createMCPClient({
        transport: new StreamableHTTPClientTransport(new URL(mcpUrl)),
      })
    ]);
    
    const tools = await client.tools();
    return { prompts, tools };
  }
}

export async function POST(req: Request) {
  console.log('Chat API: POST request received');
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();
    console.log('Chat API: Messages received:', messages);

    const mcpUrl = "https://mcpay-tech-dev.vercel.app/mcp/73b54493-048d-4433-8687-fdf2dc1ebf4d?apiKey=mcpay_btBwYdWL7KPOoQ6AKNnjNQjMSSvU8jYInOeEXgxWwj0"

    const { prompts, tools } = await getCachedMcpData(mcpUrl);

    // find system prompt  
    const systemPrompt = prompts.prompts.find((prompt: McpPrompt) => prompt.name === "system")

    const modelMessages = convertToModelMessages(messages);

    const result = streamText({
      system: systemPrompt?.content || "You are a helpful assistant.",
      model: "openai/gpt-4o",
      messages: modelMessages,
      tools,
      stopWhen: ({ steps }) => {
        return steps.length === 10;
      }
    });

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Failed to process chat request' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const mcpUrl = "https://mcpay-tech-dev.vercel.app/mcp/73b54493-048d-4433-8687-fdf2dc1ebf4d?apiKey=mcpay_btBwYdWL7KPOoQ6AKNnjNQjMSSvU8jYInOeEXgxWwj0"

  const { prompts } = await getCachedMcpData(mcpUrl);
  return NextResponse.json(prompts);
}