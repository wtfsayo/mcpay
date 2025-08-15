// Service that validates payment headers by checking the database

import { Hono } from "hono";
import { cors } from 'hono/cors';
import { handle } from 'hono/vercel';
import { withTransaction } from "@/lib/gateway/db/actions";
import { z } from "zod";

export const runtime = 'nodejs'



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

const app = new Hono({
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
app.post('/', async (c) => {
    try {
        c.header('Content-Type', 'application/json')
        
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

        console.log(`[${new Date().toISOString()}] Validating payment header`);

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

        console.log("[mcpay-validate] paymentHeader", paymentHeader);

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
