# MCPay SDK & CLI

A TypeScript SDK and CLI tool for connecting to MCP (Model Context Protocol) servers with payment capabilities using the x402 payment protocol.

## Features

- 🔌 **MCP Server Integration**: Connect to multiple MCP servers simultaneously
- 💳 **Payment Support**: Automatic handling of 402 Payment Required responses via x402 protocol
- 🛠️ **CLI Tool**: Command-line interface for quick server setup
- 📦 **SDK Library**: Programmatic API for integration into your applications
- 🔄 **Proxy Functionality**: Act as a proxy between clients and payment-enabled MCP servers

## Installation

### Global CLI Installation

```bash
# Install globally to use the CLI
npm install -g mcpay
# or
pnpm install -g mcpay
# or
yarn global add mcpay
```

### SDK Usage in Projects

```bash
# Install as a dependency in your project
npm install mcpay
# or
pnpm install mcpay
# or
yarn add mcpay
```

## CLI Usage

The MCPay CLI provides an easy way to start MCP servers with payment capabilities.

### Commands

#### Start a Payment-Enabled MCP Server

```bash
# Basic usage with environment variables
mcpay server --urls "https://api.example.com/mcp"

# With explicit private key
mcpay server --urls "https://api.example.com/mcp" --private-key "0x1234..."

# Multiple servers
mcpay server --urls "https://api1.example.com/mcp,https://api2.example.com/mcp"

# Different transport types
mcpay server --urls "https://api.example.com/mcp" --transport payment  # default
mcpay server --urls "https://api.example.com/mcp" --transport http
mcpay server --urls "https://api.example.com/mcp" --transport sse
```

#### Proxy Server (Alias)

```bash
# Same as server command
mcpay proxy --urls "https://api.example.com/mcp"
```

### Environment Variables

Set these environment variables or use CLI options:

```bash
export PRIVATE_KEY="0x1234567890abcdef..."  # Your wallet private key
export SERVER_URLS="https://api.example.com/mcp"  # Comma-separated URLs
```

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-u, --urls <urls>` | Comma-separated list of server URLs | Required |
| `-k, --private-key <key>` | Private key for wallet (or use `PRIVATE_KEY` env var) | `PRIVATE_KEY` env var |
| `-t, --transport <type>` | Transport type: `payment`, `http`, `sse` | `payment` |

## SDK Usage

Import and use the MCPay SDK in your TypeScript/JavaScript applications.

### Basic Example

```typescript
import { createPaymentTransport, startStdioServer, createServerConnections, ServerType } from 'mcpay';
import { privateKeyToAccount } from 'viem/accounts';

// Create account from private key
const account = privateKeyToAccount('0x1234567890abcdef...');

// Create server connections
const serverConnections = createServerConnections(
  ['https://api.example.com/mcp'],
  ServerType.Payment
);

// Start the stdio server
await startStdioServer({
  serverConnections,
  account,
});
```

### PaymentTransport Usage

```typescript
import { createPaymentTransport } from 'mcpay';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount('0x1234567890abcdef...');
const url = new URL('https://api.example.com/mcp');

// Create payment transport
const transport = createPaymentTransport(url, account, {
  maxPaymentValue: BigInt(0.1 * 10 ** 6), // 0.1 USDC max payment
});

// Use with MCP Client
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const client = new Client(
  { name: 'my-app', version: '1.0.0' },
  { capabilities: {} }
);

await client.connect(transport);
```

### Custom Server Setup

```typescript
import { 
  startStdioServer, 
  createServerConnections, 
  ServerType,
  type ServerConnection 
} from 'mcpay';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount('0x1234567890abcdef...');

// Create custom server connections
const serverConnections: ServerConnection[] = [
  {
    url: 'https://api1.example.com/mcp',
    serverType: ServerType.Payment,
    transportOptions: {
      maxPaymentValue: BigInt(0.05 * 10 ** 6), // 0.05 USDC
    }
  },
  {
    url: 'https://api2.example.com/mcp',
    serverType: ServerType.HTTPStream,
  }
];

// Start with custom configuration
await startStdioServer({
  serverConnections,
  account,
});
```

## API Reference

### Types

#### `ServerType`
```typescript
enum ServerType {
  HTTPStream = "HTTPStream",
  SSE = "SSE", 
  Payment = "Payment"
}
```

#### `PaymentTransportOptions`
```typescript
interface PaymentTransportOptions {
  maxPaymentValue?: bigint;  // Max payment amount in base units
  paymentRequirementsSelector?: PaymentRequirementsSelector;
  // ... extends StreamableHTTPClientTransportOptions
}
```

#### `ServerConnection`
```typescript
interface ServerConnection {
  url: string;
  serverType: ServerType;
  transportOptions?: SSEClientTransportOptions | StreamableHTTPClientTransportOptions;
  client?: Client;
}
```

### Functions

#### `createPaymentTransport(url, walletClient, options?)`
Creates a PaymentTransport instance for handling 402 Payment Required responses.

#### `startStdioServer(config)`
Starts an MCP stdio server that proxies to multiple remote servers.

#### `createServerConnections(urls, serverType?, transportOptions?)`
Helper function to create ServerConnection objects from URLs.

## Payment Protocol

MCPay uses the [x402 payment protocol](https://github.com/x402/x402) to handle micropayments for API access. When a server responds with `402 Payment Required`, the SDK automatically:

1. Parses payment requirements from the response
2. Creates a payment transaction using your wallet
3. Includes the payment proof in the retry request
4. Continues with the original API call

### Supported Networks

- Base Sepolia (testnet)
- Base (mainnet)

### Supported Assets

- USDC and other ERC-20 tokens
- Payment amounts are specified in base units (e.g., 1 USDC = 1,000,000 base units)

## Development

### Building

```bash
pnpm install
pnpm run build
```

### Local Development

```bash
# Watch mode for development
pnpm run dev
```

## Environment Setup

Create a `.env` file in your project:

```env
PRIVATE_KEY=0x1234567890abcdef...
SERVER_URLS=https://api.example.com/mcp,https://api2.example.com/mcp
```

## Examples

### CLI Examples

```bash
# Start with payment transport (default)
mcpay server -u "https://api.example.com/mcp"

# Start with multiple servers  
mcpay server -u "https://api1.com/mcp,https://api2.com/mcp"

# Use different transport
mcpay server -u "https://api.example.com/mcp" -t http
```

### SDK Examples

See the `examples/` directory for complete working examples.

## License

MIT

## Contributing

Contributions welcome! Please read our contributing guidelines and submit pull requests to our repository.

## Support

For questions and support, please open an issue on our GitHub repository. 