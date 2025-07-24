// Service that validates payment headers by checking the database

import { Hono, type Context, type Next } from "hono";
import { cors } from 'hono/cors';
import { handle } from 'hono/vercel';
import { extractApiKeyFromHeaders, hashApiKey } from "@/lib/gateway/auth-utils";
import { txOperations, withTransaction } from "@/lib/gateway/db/actions";
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

// Define extended context type for validation middleware with API key info
type ValidationAppContext = {
    Variables: {
        user: ApiKeyUser;
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
const PaymentValidationRequestSchema = z.object({
  payment: z.string().min(1),
  timestamp: z.string()
});

// Define response type matching what paid-mcp-server.ts expects
interface PaymentValidationResponse {
  isValid: boolean;
  errorReason?: string;
  paymentId?: string;
  userId?: string;
  amount?: string;
  currency?: string;
  metadata?: Record<string, unknown>;
}

const app = new Hono<ValidationAppContext>({
    strict: false,
}).basePath('/validate')

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
    console.error('Validation route error:', err)
    return c.json({
        status: 'error',
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
        service: 'mcpay-validate'
    }, 500)
})

// API key authentication middleware for validation requests
const validationAuthMiddleware = async (c: Context<ValidationAppContext>, next: Next) => {
    try {
        // Extract API key from headers
        const apiKey = extractApiKeyFromHeaders(c.req.raw.headers);

        if (!apiKey) {
            return c.json({
                status: 'error',
                message: 'API key required. Please provide a valid API key in X-API-KEY header or Authorization: Bearer header.',
                timestamp: new Date().toISOString(),
                service: 'mcpay-validate'
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
                service: 'mcpay-validate'
            }, 401);
        }

        console.log(`[${new Date().toISOString()}] User authenticated via API key: ${apiKeyResult.user.id}`);

        // Add user to context with proper typing
        c.set('user', apiKeyResult.user);
        // Store API key info in context
        c.set('apiKeyInfo', apiKeyResult.apiKey);

        await next();
    } catch (error) {
        console.error('Validation auth middleware error:', error);
        return c.json({
            status: 'error',
            message: 'Authentication failed',
            timestamp: new Date().toISOString(),
            service: 'mcpay-validate'
        }, 401);
    }
};

// Add GET endpoint for health checks
app.get('/', async (c) => {
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate')
    c.header('Content-Type', 'application/json')

    return c.json({
        status: 'ok',
        message: 'Payment validation service is running',
        timestamp: new Date().toISOString(),
        service: 'mcpay-validate'
    });
});

// Add POST endpoint for payment validation
app.post('/', validationAuthMiddleware, async (c) => {
    try {
        c.header('Content-Type', 'application/json')
        
        const user = c.get('user');
        const body = await c.req.json();
        
        // Validate the request body
        const validationResult = PaymentValidationRequestSchema.safeParse(body);
        if (!validationResult.success) {
            const response: PaymentValidationResponse = {
                isValid: false,
                errorReason: `Invalid request body: ${validationResult.error.issues.map(e => e.message).join(', ')}`
            };
            return c.json(response, 400);
        }

        const { payment: paymentHeader } = validationResult.data;

        console.log(`[${new Date().toISOString()}] Validating payment header for user: ${user.id}`);

        // Check if payment exists in database by signature
        const existingPayment = await withTransaction(async (tx) => {
            return await tx.query.payments.findFirst({
                where: (payments, { eq }) => eq(payments.signature, paymentHeader),
                with: {
                    user: {
                        columns: {
                            id: true,
                            email: true,
                            displayName: true
                        }
                    },
                    tool: {
                        columns: {
                            id: true,
                            name: true
                        }
                    }
                }
            });
        });

        if (!existingPayment) {
            console.log(`[${new Date().toISOString()}] Payment not found in database`);
            const response: PaymentValidationResponse = {
                isValid: false,
                errorReason: "Payment not found in database"
            };
            return c.json(response);
        }

        // Check if payment is completed
        if (existingPayment.status !== 'completed') {
            console.log(`[${new Date().toISOString()}] Payment found but status is: ${existingPayment.status}`);
            const response: PaymentValidationResponse = {
                isValid: false,
                errorReason: `Payment status is ${existingPayment.status}, expected completed`
            };
            return c.json(response);
        }

        // Payment is valid
        console.log(`[${new Date().toISOString()}] Payment validation successful for payment ID: ${existingPayment.id}`);
        
        const response: PaymentValidationResponse = {
            isValid: true,
            paymentId: existingPayment.id,
            userId: existingPayment.userId || undefined,
            amount: existingPayment.amountRaw,
            currency: existingPayment.currency,
            metadata: {
                network: existingPayment.network,
                transactionHash: existingPayment.transactionHash,
                settledAt: existingPayment.settledAt?.toISOString(),
                toolName: existingPayment.tool?.name,
                tokenDecimals: existingPayment.tokenDecimals,
                validatedAt: new Date().toISOString(),
                validatedBy: 'mcpay-validate-service'
            }
        };

        return c.json(response);
        
    } catch (error) {
        console.error('Error validating payment:', error);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        const response: PaymentValidationResponse = {
            isValid: false,
            errorReason: `Internal server error: ${errorMessage}`
        };
        
        return c.json(response, 500);
    }
});

export const GET = handle(app);
export const POST = handle(app);
export const OPTIONS = handle(app);
