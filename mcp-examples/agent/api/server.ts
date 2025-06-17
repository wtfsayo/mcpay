import { createMcpHandler, experimental_withMcpAuth } from "@vercel/mcp-adapter";
import { z } from "zod";
import { gateway } from "@vercel/ai-sdk-gateway";
import { generateText } from "ai";

const VALID_KEYS = process.env.VALID_KEYS?.split(",");

const handler = createMcpHandler((server) => { 

  server.tool(
    "inference", 
    "Run inference with a specified model",
    {
      prompt: z.string().describe("The prompt to infer"),
      model: z.string().describe("The model to use for inference")
    },
    async ({ prompt, model }, {authInfo}) => {

      if (!authInfo?.token) {
        return { content: [{ type: "text", text: "Unauthorized" }] };
      }

      if (!VALID_KEYS?.includes(authInfo.token)) {
        return { content: [{ type: "text", text: "Unauthorized" }] };
      }

      const text = await generateText({
        model: gateway(model),
        prompt,
      });

      return { content: [{ type: "text", text: text.text }] };
    })
});

const wrappedHandler = async (req: Request) => {
  const authHandler = experimental_withMcpAuth(handler, (req) => {
    const header = req.headers.get("Authorization");

    if (header?.startsWith("Bearer ")) {
      const token = header.slice(7).trim();
      return Promise.resolve({
        token,
        clientId: "agent-mcp",
        scopes: ["inference"],
      });
    }

    return undefined;
  });

  return authHandler(req);
};

export { wrappedHandler as GET, wrappedHandler as POST, wrappedHandler as DELETE };
