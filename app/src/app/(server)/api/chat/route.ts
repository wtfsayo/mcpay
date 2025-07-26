import { getMcpPrompts } from '@/lib/gateway/inspect-mcp';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { 
  convertToModelMessages, 
  experimental_createMCPClient as createMCPClient, 
  streamText, 
  UIMessage, 
  ToolSet, 
  generateObject,
  createUIMessageStream,
  createUIMessageStreamResponse
} from 'ai';
import { NextResponse } from 'next/server';
import { createClient } from '@vercel/kv';
import { createHash } from 'crypto';
import { getKVConfig } from '@/lib/gateway/env';
import { z } from 'zod';

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
export const maxDuration = 800;

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

// Create MCP client efficiently for serverless environment
async function createOptimizedMcpClient(mcpUrl: string): Promise<{ client: any; tools: ToolSet }> {
  console.log('Chat API: Creating optimized MCP client for serverless');

  try {
    // Use Streamable HTTP transport which is more efficient for serverless
    const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
    const client = await createMCPClient({ transport });
    const tools = await client.tools();

    return { client, tools };
  } catch (error) {
    console.error('Chat API: Failed to create MCP client:', error);
    throw error;
  }
}

async function getCachedMcpData(mcpUrl: string): Promise<CachedMcpData> {
  const promptsCacheKey = `${getCacheKey(mcpUrl)}_prompts`;

  try {
    // Check for cached prompts first
    const cachedPrompts = await kv.get(promptsCacheKey);

    if (cachedPrompts) {
      console.log('Chat API: Using cached prompts, creating fresh MCP client');

      // Always create fresh client for tools (tools are hard to serialize reliably)
      const { tools } = await createOptimizedMcpClient(mcpUrl);

      return {
        prompts: cachedPrompts as McpPromptsResponse,
        tools
      };
    }

    console.log('Chat API: Fetching fresh MCP data');

    // Fetch fresh data in parallel
    const [prompts, mcpClientResult] = await Promise.all([
      getMcpPrompts(mcpUrl),
      createOptimizedMcpClient(mcpUrl)
    ]);

    const { tools } = mcpClientResult;

    // Cache prompts only (tools are recreated each time for reliability)
    await kv.set(promptsCacheKey, prompts, { ex: CACHE_TTL });

    console.log(`Chat API: Cached prompts for ${CACHE_TTL} seconds`);

    return { prompts, tools };
  } catch (error) {
    console.error('Chat API: Cache error, falling back to fresh data:', error);

    // Fallback to fresh data if cache fails
    const [prompts, mcpClientResult] = await Promise.all([
      getMcpPrompts(mcpUrl),
      createOptimizedMcpClient(mcpUrl)
    ]);

    const { tools } = mcpClientResult;

    return { prompts, tools };
  }
}

export async function POST(req: Request) {
  console.log('Chat API: POST request received');
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();
    console.log('Chat API: Messages received:', messages);

    const mcpUrl = "https://mcpay-tech-dev.vercel.app/mcp/73b54493-048d-4433-8687-fdf2dc1ebf4d?apiKey=mcpay_btBwYdWL7KPOoQ6AKNnjNQjMSSvU8jYInOeEXgxWwj0";

    const { prompts, tools } = await getCachedMcpData(mcpUrl);

    // find system prompt  
    const systemPrompt = prompts.prompts.find((prompt: McpPrompt) => prompt.name === "system");

    const modelMessages = convertToModelMessages(messages);

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
    
        const result = streamText({
          system: systemPrompt?.content || "You are a helpful assistant.",
          model: "openai/gpt-4o",
          messages: modelMessages,
          tools,
          onStepFinish: async ({ toolResults, toolCalls, usage, finishReason }) => {
            toolResults.forEach(async (toolResult) => {
              if (toolResult.toolName === 'create_session') {
                const result = await generateObject({
                  model: "openai/gpt-4o-mini",
                  schema: z.object({
                    sessionId: z.string(),
                  }),
                  prompt: `Generate a session ID based on the tool result: ${toolResult.output}`,
                });
                
                // Stream the session ID back to the client
                writer.write({
                  type: 'data-session',
                  data: { sessionId: result.object.sessionId },
                });
              }
              if (toolResult.toolName === 'preview') {

                const result = await generateObject({
                  model: "openai/gpt-4o-mini",
                  schema: z.object({
                    url: z.string(),
                  }),
                  prompt: `Extract the preview URL from the tool result: ${JSON.stringify(toolResult.output, null, 2)}`,
                });

                console.log('Tool result:', JSON.stringify(toolResult, null, 2));
                console.log('Preview URL:', JSON.stringify(result.object.url, null, 2));

                writer.write({
                  type: 'data-preview',
                  data: { url: result.object.url },
                });
              }
            });
          },
          stopWhen: ({ steps }) => {
            return steps.length === 10;
          },
        });
        
        writer.merge(result.toUIMessageStream());
      },
    });
    
    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Failed to process chat request' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const mcpUrl = "https://mcpay-tech-dev.vercel.app/mcp/73b54493-048d-4433-8687-fdf2dc1ebf4d?apiKey=mcpay_btBwYdWL7KPOoQ6AKNnjNQjMSSvU8jYInOeEXgxWwj0";

  const { prompts } = await getCachedMcpData(mcpUrl);
  return NextResponse.json({ prompts });
}