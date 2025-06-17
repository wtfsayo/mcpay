import { createMcpHandler, experimental_withMcpAuth } from "@vercel/mcp-adapter";
import { z } from "zod";
import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY,
});

const VALID_KEYS = process.env.VALID_KEYS?.split(",");

const handler = createMcpHandler((server) => { 

  server.tool(
    "uploadFile", 
    "Upload a JSON file to Pinata Cloud",
    {
      json: z.string().describe("The JSON file to upload"),
    },
    async ({ json }, {authInfo}) => {

      if (!authInfo?.token) {
        return { content: [{ type: "text", text: "Unauthorized" }] };
      }

      if (!VALID_KEYS?.includes(authInfo.token)) {
        return { content: [{ type: "text", text: "Unauthorized" }] };
      }

      const upload = await pinata.upload.public.json({
        content: json,
        name: "data.json",
        lang: "json"
    })

      return { content: [{ type: "text", text: upload.cid }] };
    })
});

const wrappedHandler = async (req: Request) => {
  const authHandler = experimental_withMcpAuth(handler, (req) => {
    const header = req.headers.get("Authorization");

    if (header?.startsWith("Bearer ")) {
      const token = header.slice(7).trim();
      return Promise.resolve({
        token,
        clientId: "pinata.cloud-mcp",
        scopes: ["inference"],
      });
    }

    return undefined;
  });

  return authHandler(req);
};

export { wrappedHandler as GET, wrappedHandler as POST, wrappedHandler as DELETE };
