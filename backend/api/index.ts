import { Hono } from "hono";
import api from "./api.js";    
import mcpProxy from "./mcp-proxy.js";

const app = new Hono();

app.route('/api', api);
app.route('/mcp', mcpProxy);

export const GET = app.fetch;
export const POST = app.fetch;
export const DELETE = app.fetch;
