import { createMcpHandler, experimental_withMcpAuth } from "@vercel/mcp-adapter";
import { z } from "zod";
import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY,
});

const VALID_KEYS = process.env.VALID_KEYS?.split(",");

// x402-inspired pricing constants
const PRICE_PER_GB = 0.1;
const MONTHS = 12;
const MIN_PRICE = 0.0001;

// Calculate pricing based on file size
function calculatePrice(fileSize: number): number {
  const fileSizeInGB = fileSize / (1024 * 1024 * 1024);
  const price = fileSizeInGB * PRICE_PER_GB * MONTHS;
  return price >= MIN_PRICE ? price : MIN_PRICE;
}

const handler = createMcpHandler((server) => {
  
  // Public file upload tool
  server.tool(
    "uploadPublicFile",
    "Upload a file to public IPFS",
    {
      content: z.string().describe("The file content to upload"),
      filename: z.string().describe("The filename for the upload"),
    },
    async ({ content, filename }, { authInfo }) => {
      if (!authInfo?.token) {
        return { content: [{ type: "text", text: "Unauthorized - Bearer token required" }] };
      }

      if (!VALID_KEYS?.includes(authInfo.token)) {
        return { content: [{ type: "text", text: "Unauthorized - Invalid API key" }] };
      }

      const fileSize = content.length;

      const price = calculatePrice(fileSize);
      
      try {
        const upload = await pinata.upload.public.json({
          content: content,
          name: filename,
          lang: filename.split('.').pop() || "txt",
          keyvalues: {
            account: authInfo.extra?.walletAddress || "unknown",
            pricing: price.toString(),
            network: "public",
            uploadDate: new Date().toISOString()
          }
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              cid: upload.cid,
              network: "public",
              estimatedCost: `$${price.toFixed(4)}`,
              description: "Pay2Pin - Public IPFS upload",
              gatewayUrl: `https://gateway.pinata.cloud/ipfs/${upload.cid}`
            }, null, 2)
          }]
        };
      } catch (error) {
        return { content: [{ type: "text", text: `Upload failed: ${error}` }] };
      }
    }
  );

  // Private file upload tool
  server.tool(
    "uploadPrivateFile",
    "Upload a file to private IPFS with x402-inspired pricing and access control",
    {
      content: z.string().describe("The file content to upload"),
      filename: z.string().describe("The filename for the upload"),
    },
    async ({ content, filename }, { authInfo }) => {
      if (!authInfo?.token) {
        return { content: [{ type: "text", text: "Unauthorized - Bearer token required" }] };
      }

      if (!VALID_KEYS?.includes(authInfo.token)) {
        return { content: [{ type: "text", text: "Unauthorized - Invalid API key" }] };
      }

      if (!authInfo.extra?.walletAddress) {
        return { content: [{ type: "text", text: "Wallet address required for private uploads" }] };
      }

      const fileSize = content.length;

      const price = calculatePrice(fileSize);
      
      try {
        const upload = await pinata.upload.private.json({
          content: content,
          name: filename,
          lang: filename.split('.').pop() || "txt",
          keyvalues: {
            account: authInfo.extra?.walletAddress,
            pricing: price.toString(),
            network: "private",
            uploadDate: new Date().toISOString()
          }
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              cid: upload.cid,
              network: "private",
              estimatedCost: `$${price.toFixed(4)}`,
              description: "Pay2Pin - Private IPFS upload",
              owner: authInfo.extra?.walletAddress,
              note: "Use retrievePrivateFile to access this content"
            }, null, 2)
          }]
        };
      } catch (error) {
        return { content: [{ type: "text", text: `Private upload failed: ${error}` }] };
      }
    }
  );

  // Private file retrieval tool
  server.tool(
    "retrievePrivateFile",
    "Retrieve a private file from IPFS with x402-inspired access control",
    {
      cid: z.string().describe("The CID of the private file to retrieve"),
    },
    async ({ cid }, { authInfo }) => {
      if (!authInfo?.token) {
        return { content: [{ type: "text", text: "Unauthorized - Bearer token required" }] };
      }

      if (!VALID_KEYS?.includes(authInfo.token)) {
        return { content: [{ type: "text", text: "Unauthorized - Invalid API key" }] };
      }

      if (!authInfo.extra?.walletAddress || typeof authInfo.extra?.walletAddress !== "string") {
        return { content: [{ type: "text", text: "Wallet address required for private file retrieval" }] };
      }

      try {
        // List files to verify ownership
        const files = await pinata.files.private.list().keyvalues({ account: authInfo.extra?.walletAddress });
        
        const authorizedFile = files.files?.find(f => f.cid === cid);
        if (!authorizedFile) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                error: "Unauthorized - File not found or access denied",
                description: "Pay2Read - Private file access"
              }, null, 2)
            }]
          };
        }

        // Create temporary access link
        const accessLink = await pinata.gateways.private.createAccessLink({
          cid: cid,
          expires: 3600, // 1 hour access
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              accessUrl: accessLink,
              description: "Pay2Read - Private file access granted",
              expiresIn: "1 hour",
              filename: authorizedFile.name
            }, null, 2)
          }]
        };
      } catch (error) {
        return { content: [{ type: "text", text: `Retrieval failed: ${error}` }] };
      }
    }
  );

  // Pricing calculator tool
  server.tool(
    "calculatePinningCost",
    "Calculate the cost to pin a file based on x402 pricing model",
    {
      fileSize: z.number().describe("File size in bytes"),
      months: z.number().optional().describe("Number of months to pin (default: 12)"),
    },
    async ({ fileSize, months = 12 }) => {
      const fileSizeInGB = fileSize / (1024 * 1024 * 1024);
      const customPrice = fileSizeInGB * PRICE_PER_GB * months;
      const finalPrice = customPrice >= MIN_PRICE ? customPrice : MIN_PRICE;
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            fileSize: fileSize,
            fileSizeGB: fileSizeInGB.toFixed(6),
            months: months,
            pricePerGB: `$${PRICE_PER_GB}`,
            calculatedCost: `$${finalPrice.toFixed(4)}`,
            minimumCost: `$${MIN_PRICE}`,
            description: "x402-inspired pricing: $0.10/GB for 12 months of pinning"
          }, null, 2)
        }]
      };
    }
  );
});

const wrappedHandler = async (req: Request) => {
  const authHandler = experimental_withMcpAuth(handler, (req) => {
    const header = req.headers.get("Authorization");
    const walletAddress = req.headers.get("x-mcpay-wallet-address");

    if (header?.startsWith("Bearer ")) {
      const token = header.slice(7).trim();
      return Promise.resolve({
        token,
        extra: {
          walletAddress,
        },
        clientId: "pinata.cloud-x402-mcp", 
        scopes: ["uploadPublicFile", "uploadPrivateFile", "retrievePrivateFile", "calculatePinningCost"],
      });
    }

    return Promise.resolve({
      token: "",
      extra: {
        walletAddress,
      },
      clientId: "pinata.cloud-x402-mcp",
      scopes: ["uploadPublicFile", "uploadPrivateFile", "retrievePrivateFile", "calculatePinningCost"], 
    });
  });

  return authHandler(req);
};

export { wrappedHandler as GET, wrappedHandler as POST, wrappedHandler as DELETE };
