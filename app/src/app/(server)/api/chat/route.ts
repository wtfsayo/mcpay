import { getMcpPrompts } from '@/lib/gateway/inspect-mcp';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { convertToModelMessages, experimental_createMCPClient as createMCPClient, streamText, UIMessage } from 'ai';
import { NextResponse } from 'next/server';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  console.log('Chat API: POST request received');
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();
    console.log('Chat API: Messages received:', messages);

    const mcpUrl = "https://mcpay-tech-dev.vercel.app/mcp/73b54493-048d-4433-8687-fdf2dc1ebf4d?apiKey=mcpay_btBwYdWL7KPOoQ6AKNnjNQjMSSvU8jYInOeEXgxWwj0"

    const getMcpPromptsResponse = await getMcpPrompts(mcpUrl);
    const client = await createMCPClient({
      transport: new StreamableHTTPClientTransport(new URL(mcpUrl)),
    });

    const tools = await client.tools();

    // find system prompt
    const systemPrompt = getMcpPromptsResponse.prompts.find((prompt) => prompt.name === "system")

    const modelMessages = convertToModelMessages(messages);

    console.log('modelMessages', modelMessages);

    const result = streamText({
      system: systemPrompt?.content || "You are a helpful assistant.",
      model: "gpt-4o",
      messages: modelMessages,
      tools
    });

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Failed to process chat request' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const mcpUrl = "https://mcpay-tech-dev.vercel.app/mcp/73b54493-048d-4433-8687-fdf2dc1ebf4d?apiKey=mcpay_btBwYdWL7KPOoQ6AKNnjNQjMSSvU8jYInOeEXgxWwj0"

  const prompts = await getMcpPrompts(mcpUrl);
  return NextResponse.json(prompts);
}