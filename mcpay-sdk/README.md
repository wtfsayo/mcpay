# MCPay SDK

A TypeScript SDK for MCPay functionality.

## Installation

```bash
npm install mcpay-sdk
# or
yarn add mcpay-sdk
# or
pnpm add mcpay-sdk
```

## Usage

```typescript
import MCPaySDK from 'mcpay-sdk';

// Initialize the SDK
const mcpay = new MCPaySDK({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.mcpay.fun' // optional, defaults to this
});

// Or configure later
const mcpay = new MCPaySDK();
mcpay.configure({
  apiKey: 'your-api-key'
});
```

## Development

### Setup

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build

# Watch for changes during development
pnpm run dev

# Clean build artifacts
pnpm run clean
```

### Project Structure

```
mcpay-sdk/
├── src/           # TypeScript source files
├── dist/          # Compiled JavaScript output
├── package.json   # Package configuration
├── tsconfig.json  # TypeScript configuration
└── README.md      # This file
```

## License

MIT 