// Service that generates payment requirements for MCP tool calls

import { fromBaseUnits } from "@/lib/commons";
import { getNetworkTokens } from "@/lib/commons/networks";
import { extractApiKeyFromHeaders, hashApiKey } from "@/lib/gateway/auth-utils";
import { txOperations, withTransaction } from "@/lib/gateway/db/actions";
import { createExactPaymentRequirements } from "@/lib/gateway/payments";
import type { SupportedNetwork } from "@/types/x402";
import { Hono, type Context, type Next } from "hono";
import { cors } from 'hono/cors';
import { handle } from 'hono/vercel';
import { z } from "zod";

export const runtime = 'nodejs'

// Define user type that matches what we get from API key validation
type ApiKeyUser = {
    id: string;
    name: string | null;
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    image: string | null;
};

// Define extended context type for requirements middleware with API key info
type RequirementsAppContext = {
    Variables: {
        user: ApiKeyUser;
        userWalletAddress: string | null;
        apiKeyInfo?: {
            id: string;
            userId: string;
            keyHash: string;
            name: string;
            permissions: string[];
            createdAt: Date;
            expiresAt: Date | null;
            lastUsedAt: Date | null;
            active: boolean;
        };
    };
};

// Define input validation schemas
const SimplePaymentOptionsSchema = z.object({
  price: z.number().positive(),
  currency: z.string().default('USD'),
  recipient: z.string().optional(),
  network: z.string().optional()
});

const AdvancedPaymentOptionsSchema = z.object({
  recipient: z.string(),
  rawAmount: z.string(),
  tokenDecimals: z.number().int().min(0).max(18),
  tokenAddress: z.string().optional(),
  network: z.union([z.number(), z.string()]),
  tokenSymbol: z.string().optional()
});

const PaymentOptionsSchema = z.union([SimplePaymentOptionsSchema, AdvancedPaymentOptionsSchema]);

const PaymentRequirementsRequestSchema = z.object({
  tool: z.string().min(1),
  paymentOptions: PaymentOptionsSchema,
  timestamp: z.string()
});

type SimplePaymentOptions = z.infer<typeof SimplePaymentOptionsSchema>;
type AdvancedPaymentOptions = z.infer<typeof AdvancedPaymentOptionsSchema>;

const app = new Hono<RequirementsAppContext>({
    strict: false,
}).basePath('/requirements')

// Add CORS middleware to handle cross-origin requests
app.use('*', cors({
    origin: '*', // You might want to restrict this to your domain in production
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: false,
}))

// Add error handling middleware
app.onError((err, c) => {
    console.error('Requirements route error:', err)
    return c.json({
        status: 'error',
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
        service: 'mcpay-requirements'
    }, 500)
})

// API key authentication middleware for requirements requests
const requirementsAuthMiddleware = async (c: Context<RequirementsAppContext>, next: Next) => {
    try {
        // Extract API key from headers
        const apiKey = extractApiKeyFromHeaders(c.req.raw.headers);

        if (!apiKey) {
            return c.json({
                status: 'error',
                message: 'API key required. Please provide a valid API key in X-API-KEY header or Authorization: Bearer header.',
                timestamp: new Date().toISOString(),
                service: 'mcpay-requirements'
            }, 401);
        }

        // Validate API key
        const keyHash = hashApiKey(apiKey);
        const apiKeyResult = await withTransaction(async (tx) => {
            return await txOperations.validateApiKey(keyHash)(tx);
        });

        if (!apiKeyResult?.user) {
            return c.json({
                status: 'error',
                message: 'Invalid or expired API key.',
                timestamp: new Date().toISOString(),
                service: 'mcpay-requirements'
            }, 401);
        }

        console.log(`[${new Date().toISOString()}] User authenticated via API key: ${apiKeyResult.user.id}`);

        // Add user to context with proper typing
        c.set('user', apiKeyResult.user);
        // Store API key info in context
        c.set('apiKeyInfo', apiKeyResult.apiKey);

        // Get user's primary wallet address for default recipient
        let userWalletAddress: string | null = null;
        try {
            const userWallets = await withTransaction(async (tx) => {
                return await tx.query.userWallets.findMany({
                    where: (userWallets, { eq, and }) => and(
                        eq(userWallets.userId, apiKeyResult.user.id),
                        eq(userWallets.isActive, true)
                    ),
                    orderBy: (userWallets, { desc }) => [desc(userWallets.isPrimary), desc(userWallets.createdAt)],
                    limit: 1
                });
            });

            userWalletAddress = userWallets[0]?.walletAddress || null;
            console.log(`[${new Date().toISOString()}] User wallet address: ${userWalletAddress}`);
        } catch (error) {
            console.warn('Failed to get user wallet address:', error);
        }

        // Store wallet address in context
        c.set('userWalletAddress', userWalletAddress);

        await next();
    } catch (error) {
        console.error('Requirements auth middleware error:', error);
        return c.json({
            status: 'error',
            message: 'Authentication failed',
            timestamp: new Date().toISOString(),
            service: 'mcpay-requirements'
        }, 401);
    }
};

// Helper function to check if payment options are simple
function isSimplePaymentOptions(options: SimplePaymentOptions | AdvancedPaymentOptions): options is SimplePaymentOptions {
    return 'price' in options;
}

// Helper function to convert PaymentOptions to payment requirements
function processPaymentOptions(
    tool: string,
    paymentOptions: SimplePaymentOptions | AdvancedPaymentOptions,
    userWalletAddress: string | null
) {
    const network = (paymentOptions.network || 'sei-testnet') as SupportedNetwork;
    const resource = `mcpay://tool/${tool}` as `${string}://${string}`;
    const description = `Payment for ${tool} tool execution`;

    if (isSimplePaymentOptions(paymentOptions)) {
        // Handle simple payment options (USD price)
        const { price, currency, recipient } = paymentOptions;
        
        if (currency.toUpperCase() !== 'USD') {
            throw new Error(`Currency ${currency} not supported. Only USD is currently supported for simple payment options.`);
        }

        // Use recipient from options, fallback to user's wallet, then to default
        const payTo = (recipient as `0x${string}`) || 
                     (userWalletAddress as `0x${string}`) || 
                     "0x742d35Cc6634C0532925a3b8D42d5Fde6D5FfFd6" as `0x${string}`;
        
        return createExactPaymentRequirements(
            price.toString(), // Convert USD amount to string
            network,
            resource,
            description,
            payTo
        );
    } else {
        // Handle advanced payment options (raw amounts)
        const { recipient, rawAmount, tokenSymbol = 'USDC' } = paymentOptions;
        
        // Get token info to determine decimals
        const tokens = getNetworkTokens(network);
        const token = tokens.find(t => t.symbol === tokenSymbol.toUpperCase());
        
        if (!token) {
            throw new Error(`Token ${tokenSymbol} not found on network ${network}`);
        }

        // Convert rawAmount from base units to human-readable format for createExactPaymentRequirements
        // Since createExactPaymentRequirements expects a price string and will convert it back to base units
        const humanAmount = fromBaseUnits(rawAmount, token.decimals);
        
        const payTo = recipient as `0x${string}`;
        
        return createExactPaymentRequirements(
            humanAmount,
            network,
            resource,
            description,
            payTo
        );
    }
}

// Add GET endpoint for health checks
app.get('/', async (c) => {
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate')
    c.header('Content-Type', 'application/json')

    return c.json({
        status: 'ok',
        message: 'Requirements service is running',
        timestamp: new Date().toISOString(),
        service: 'mcpay-requirements'
    });
});

// Add POST endpoint for generating payment requirements
app.post('/', requirementsAuthMiddleware, async (c) => {
    try {
        c.header('Content-Type', 'application/json')
        
        const user = c.get('user');
        const userWalletAddress = c.get('userWalletAddress');
        
        const body = await c.req.json();
        
        // Validate the request body
        const validationResult = PaymentRequirementsRequestSchema.safeParse(body);
        if (!validationResult.success) {
            return c.json({
                status: 'error',
                message: 'Invalid request body',
                errors: validationResult.error.issues,
                timestamp: new Date().toISOString(),
                service: 'mcpay-requirements'
            }, 400);
        }

        const { tool, paymentOptions } = validationResult.data;

        console.log(`[${new Date().toISOString()}] Generating payment requirements for tool: ${tool}, user: ${user.id}`);

        // Process the payment options and generate requirements
        const paymentRequirements = processPaymentOptions(tool, paymentOptions, userWalletAddress);

        console.log(`[${new Date().toISOString()}] Generated payment requirements:`, JSON.stringify(paymentRequirements, null, 2));

        // Return the payment requirements in the expected format
        return c.json(paymentRequirements);
        
    } catch (error) {
        console.error('Error generating payment requirements:', error);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        return c.json({
            status: 'error',
            message: `Failed to generate payment requirements: ${errorMessage}`,
            timestamp: new Date().toISOString(),
            service: 'mcpay-requirements'
        }, 500);
    }
});

export const GET = handle(app);
export const POST = handle(app);
export const OPTIONS = handle(app);