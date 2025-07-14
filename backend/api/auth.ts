import { cors } from "hono/cors";
import { auth } from "../lib/auth.js";
import { Hono } from "hono";

const app = new Hono();

// Specific CORS configuration for auth routes - more restrictive
app.use('*', cors({
    origin: (origin) => {
        // Only allow specific origins for auth endpoints
        const allowedOrigins = [
            'https://mcpay.fun',
            'https://www.mcpay.fun',
            'http://localhost:3232',
            'http://localhost:3000'
        ];
        
        // In development, be more permissive but still controlled
        if (process.env.NODE_ENV === 'development') {
            const devOrigins = [
                ...allowedOrigins,
                'http://localhost:3001',
                'http://localhost:3002',
                'http://localhost:5173', // Vite default
                'http://localhost:4173'  // Vite preview
            ];
            return devOrigins.includes(origin || '') ? origin : null;
        }
        
        return allowedOrigins.includes(origin || '') ? origin : null;
    },
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600, // Shorter cache time for auth endpoints
    credentials: true
}));

app.all("*", (c) => {
    return auth.handler(c.req.raw)
});

export default app;