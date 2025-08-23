# MCPay SDK & CLI

A TypeScript SDK and CLI for connecting to MCP (Model Context Protocol) servers with payment capabilities via the x402 protocol. It can:

- 🔌 Connect to multiple MCP servers at once (proxy)
- 💳 Handle 402 Payment Required automatically (x402)
- 📦 Provide programmatic APIs for clients and servers

## Quick start

Install the CLI globally or use `npx`:

```bash
npm i -g mcpay
# or
npx mcpay server -u "https://api.example.com/mcp" -a "<YOUR_API_KEY>"
```

Start a payment-aware stdio proxy to one or more MCP servers:

```bash
# Using a private key (Payment transport)
mcpay server -u "https://api.example.com/mcp" -k 0x1234...

# Using an API key only (HTTP transport)
mcpay server -u "https://api.example.com/mcp" -a "$API_KEY"
```

Tip: You can pass multiple URLs: `-u "https://api1/mcp,https://api2/mcp"`.

## Installation

### SDK (project dependency)

```bash
npm i mcpay
# or
pnpm i mcpay
# or
yarn add mcpay
```

## CLI

### Commands

- `mcpay server` – start an MCP stdio proxy to remote servers

### Examples

```bash
# Basic (env vars)
export SERVER_URLS="https://api.example.com/mcp"
export PRIVATE_KEY="0x1234..."
mcpay server -u "$SERVER_URLS"

# Multiple servers + API key header forwarded to remotes
mcpay server -u "https://api1/mcp,https://api2/mcp" -a "$API_KEY"
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-u, --urls <urls>` | Comma-separated list of MCP server URLs | Required |
| `-k, --private-key <key>` | EVM private key used to sign x402 payments | `PRIVATE_KEY` env |
| `-a, --api-key <key>` | API key forwarded as `Authorization: Bearer ...` | `API_KEY` env |

Behavior:
- If `--private-key` is provided, the proxy uses Payment transport (x402) and can settle 402 challenges automatically.
- If only `--api-key` is provided, the proxy uses standard HTTP transport and forwards the bearer token.

## Financial Server Integration Guide

### MCP Client Integration

Connect to AI assistants like Claude, Cursor, and Windsurf.

#### One-Click Install for Cursor

If available on the website, use the "Install in Cursor" action to auto-generate an API key and configure your Cursor MCP settings.

#### Manual Configuration with API Key (Recommended)

Create an API key in your account settings and add this to your MCP client config (e.g., `claude_desktop_config.json`). Replace `mcpay_YOUR_API_KEY_HERE` with your real key.

```json
{
  "mcpServers": {
    "Financial Server": {
      "command": "npx",
      "args": [
        "mcpay",
        "server",
        "--urls",
        "https://mcpay.tech/mcp/d67aaf0d-fcc8-4136-948d-c470abe41ac0",
        "--api-key",
        "mcpay_YOUR_API_KEY_HERE"
      ]
    }
  }
}
```

#### Manual Configuration with Private Key (Alternative)

Use a wallet private key instead of an API key. Replace with your own private key (handle securely).

```json
{
  "mcpServers": {
    "Financial Server": {
      "command": "npx",
      "args": [
        "mcpay",
        "server",
        "--urls",
        "https://mcpay.tech/mcp/d67aaf0d-fcc8-4136-948d-c470abe41ac0",
        "--private-key",
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
      ]
    }
  }
}
```

### MCPay CLI (Direct Connection)

```bash
# Using API Key (recommended)
npx mcpay server --urls https://mcpay.tech/mcp/d67aaf0d-fcc8-4136-948d-c470abe41ac0 --api-key mcpay_YOUR_API_KEY_HERE

# Using Private Key (alternative)
npx mcpay server --urls https://mcpay.tech/mcp/d67aaf0d-fcc8-4136-948d-c470abe41ac0 --private-key 0xYOUR_PRIVATE_KEY
```

### Direct API Integration (JavaScript/TypeScript SDK)

```ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { createPaymentTransport } from 'mcpay'
import { privateKeyToAccount } from 'viem/accounts'

// Initialize account from private key
const account = privateKeyToAccount('0x1234567890abcdef...')
const url = new URL('https://mcpay.tech/mcp/d67aaf0d-fcc8-4136-948d-c470abe41ac0')

// Create payment-enabled transport
const transport = createPaymentTransport(url, account, {
  maxPaymentValue: BigInt(0.1 * 10 ** 6), // 0.1 USDC max payment
})

// Initialize MCP client
const client = new Client(
  { name: 'my-mcp-client', version: '1.0.0' },
  { capabilities: {} }
)

// Connect and use tools
await client.connect(transport)
const tools = await client.listTools()
console.log('Available tools:', tools)
```

## SDK usage

### Programmatic stdio proxy

```ts
import { startStdioServer, createServerConnections, ServerType } from 'mcpay';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount('0x123...');
const serverConnections = createServerConnections(
  ['https://api.example.com/mcp'],
  ServerType.Payment
);

await startStdioServer({ serverConnections, account });
```

### Client: PaymentTransport

```ts
import { createPaymentTransport } from 'mcpay';
import { privateKeyToAccount } from 'viem/accounts';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const account = privateKeyToAccount('0x123...');
const transport = createPaymentTransport(new URL('https://api.example.com/mcp'), account, {
  maxPaymentValue: BigInt(0.1 * 10 ** 6) // 0.10 USDC
});

const client = new Client({ name: 'my-app', version: '1.0.0' }, { capabilities: {} });
await client.connect(transport);
```

### Protecting your MCP server with payments

Use `createPaidMcpHandler` to require a valid `X-PAYMENT` header (validated via MCPay) before your tools run. Works in serverless/edge-compatible runtimes.

```ts
import { createPaidMcpHandler } from 'mcpay';
import { z } from 'zod';

const handler = createPaidMcpHandler(async (server) => {
  server.paidTool(
    'hello',
    { price: 0.05, currency: 'USD' },
    { name: z.string().describe('Your name') },
    async ({ name }) => ({ content: [{ type: 'text', text: `Hello, ${name}!` }] })
  );
}, {
  mcpay: {
    mcpayApiUrl: process.env.MCPAY_API_URL || 'https://mcpay.fun',
    apiKey: process.env.MCPAY_API_KEY || ''
  }
});

// Next.js (route handlers)
export { handler as GET, handler as POST, handler as DELETE };
```

Notes:
- `server.paidTool` accepts either a simple price `{ price, currency, recipient? }` or advanced on-chain params `{ recipient, rawAmount, tokenDecimals, network, ... }`.
- When no valid payment is provided, the handler returns structured payment requirements that clients (like `PaymentTransport`) can satisfy.

## Environment variables

CLI:
- `PRIVATE_KEY`: Hex private key for x402 signing
- `SERVER_URLS`: Comma-separated MCP endpoints
- `API_KEY`: Optional, forwarded as `Authorization: Bearer <API_KEY>` to remotes

Server (payment auth):
- `MCPAY_API_URL` (default `https://mcpay.fun`)
- `MCPAY_API_KEY`
- `MCPAY_API_VALIDATION_PATH` (default `/validate`)
- `MCPAY_API_REQUIREMENTS_PATH` (default `/requirements`)
- `MCPAY_API_PING_PATH` (default `/ping`)

## Transports

- `HTTPStream` – standard streaming HTTP transport
- `Payment` – extends HTTP transport; automatically handles `402 Payment Required` using x402 and your wallet

## Payment protocol (x402)

On a `402 Payment Required` response, MCPay will:
1. Parse the server-provided requirements
2. Create and sign an authorization with your wallet
3. Retry the original request with `X-PAYMENT` header

Supported networks: Base Sepolia, Base (plus additional EVM testnets/mainnets as released). Default USDC addresses are built-in per chain.

## Troubleshooting

- "Payment amount exceeds maximum allowed": increase `maxPaymentValue` on `PaymentTransport`.
- Wrong chain/network: ensure your wallet/client chain matches the server requirement (Base Sepolia by default).
- Ping warnings at startup: set `ping: { enabled: false }` in `createPaidMcpHandler` options or ensure `MCPAY_API_URL` is reachable.

## Development

```bash
pnpm i
pnpm run build
# Dev watch
pnpm run dev
```

## Security

- Never commit private keys. Prefer environment variables and scoped, low-value keys for development.
- Use the `maxPaymentValue` guard in clients and per-tool pricing in servers.

## License

MIT

## Contributing

Issues and PRs are welcome.

## Support

Please open an issue in the repository.