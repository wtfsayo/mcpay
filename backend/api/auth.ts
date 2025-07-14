import { Hono } from "hono";
import { auth, AuthType } from "../lib/auth.js";

const app = new Hono<{ Bindings: AuthType }>({
    strict: false,
})

// Handle actual auth requests
app.on(['POST', 'GET'], '/*', (c) => {
    return auth.handler(c.req.raw)
})

export default app;