import { createMcpHandler, experimental_withMcpAuth } from "@vercel/mcp-adapter";
import { z } from "zod";
import { runAgent } from "../lib/agent.js";

const VALID_KEYS = process.env.VALID_KEYS?.split(",");

const handler = createMcpHandler((server) => { 

  server.tool(
    "runAgent", 
    "Run the agent",
    {
      prompt: z.string().describe("The prompt to run the agent"),
    },
    async ({ prompt }, {authInfo}) => {

      if (!authInfo?.token) {
        return { content: [{ type: "text", text: "Unauthorized" }] };
      }

      if (!VALID_KEYS?.includes(authInfo.token)) {
        return { content: [{ type: "text", text: "Unauthorized" }] };
      }

      const result = await runAgent(prompt)

      return { content: [{ type: "text", text: result }] };
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
        scopes: ["runAgent"],
      });
    }

    return undefined;
  });

  return authHandler(req);
};

export { wrappedHandler as DELETE, wrappedHandler as GET, wrappedHandler as POST };

