# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCPay is a payment layer for MCP (Model Context Protocol) servers and HTTP APIs using the HTTP 402 Payment Required status and x402 pattern. The project consists of:

- **Next.js App** (`app/`): Website, registry, builder, monetizer proxy, and APIs
- **SDK/CLI** (`js-sdk/`): TypeScript SDK and command-line tools for MCPay functionality

## Commands

### App Development (Next.js)
```bash
# Navigate to app directory first
cd app

# Development
bun run dev              # Start development server with Turbopack
bun run dev:no-turbo     # Start development server without Turbopack
bun run build            # Build the application
bun run start            # Start production server
bun run lint             # Run ESLint

# Database operations  
bun run db:apply-changes    # Push schema changes to database
bun run db:generate-migrations  # Generate migration files
bun run db:migrate          # Run migrations
bun run db:studio          # Open Drizzle Studio

# Testing
bun run e2e:install     # Install Playwright dependencies
bun run e2e:test        # Run end-to-end tests
bun run e2e:ui          # Run tests with UI
bun run e2e:show-report # Show test report

# Account management scripts
bun run account:generate        # Generate test accounts
bun run account:add-managed     # Add managed wallets and fund them
```

### SDK Development
```bash
# Navigate to js-sdk directory first
cd js-sdk

# Build and development
bun run build           # Build TypeScript to dist/
bun run dev             # Watch mode for development
bun run clean           # Remove dist/ directory

# CLI usage examples
npx mcpay server --help  # Show CLI help
```

## Architecture

### App Structure (`app/`)

**Core Architecture:**
- **Next.js 15** with React 19, TypeScript, and Tailwind CSS
- **Database:** PostgreSQL with Drizzle ORM
- **Authentication:** Better-auth with GitHub OAuth support
- **Payments:** x402 pattern with multi-chain support (Base, SEI, etc.)
- **UI:** shadcn/ui components with Radix UI primitives

**Key Directories:**
- `src/app/(server)/`: Server-side route handlers and API endpoints
- `src/components/custom-ui/`: Application-specific components
- `src/components/ui/`: Reusable shadcn/ui components  
- `src/lib/gateway/`: Core business logic, database, payments, auth
- `src/lib/client/`: Client-side utilities and configurations

**API Routes:**
- `/api/servers` - MCP server registry and analytics
- `/mcp/:id/*` - MCP proxy with payment enforcement (x402)
- `/api/chat` - Builder chat interface with MCP client
- `/requirements` - Payment requirement generation
- `/validate` - Payment validation and settlement
- `/ping` - MCP server inspection and auto-registration

### Database Schema (`app/src/lib/gateway/db/schema.ts`)

**Important:** All monetary amounts use `NUMERIC(38,0)` storing base units (atomic units) to avoid floating-point precision issues. Each record includes `token_decimals` for reconstruction.

**Key Tables:**
- `users` - User accounts (wallet + traditional auth)
- `servers` - MCP server registry  
- `mcpTools` - Tool definitions with pricing (in JSONB)
- `payments` - Payment records with `amount_raw` + `token_decimals`
- `analytics` - Usage and revenue tracking

### SDK Structure (`js-sdk/`)

**Core Components:**
- `src/client.ts` - Payment transport for MCP clients with x402 handling
- `src/handler.ts` - Next.js handler for building paid MCP servers
- `src/server.ts` - Stdio proxy server for CLI usage
- `src/cli/` - Command-line interface implementation
- `src/x402/` - x402 payment pattern utilities

### Payment System

**Payment Strategies** (`app/src/lib/gateway/payment-strategies/`):
- **CDP Strategy**: Coinbase Developer Platform integration
- **Testing Strategy**: Development/testing with mock payments
- **Multi-chain support**: Base, Base Sepolia, SEI Testnet

**Environment Configuration** (`app/src/lib/gateway/env.ts`):
Comprehensive Zod validation for all environment variables including database, auth, CDP, facilitator URLs, and payment strategy settings.

## Development Workflow

### Local Development Setup
1. Set required environment variables in `.env` (see `app/src/lib/gateway/env.ts`)
2. Run database migrations: `cd app && bun run db:apply-changes` 
3. Start development: `cd app && bun run dev`

### Making Changes
- **Database changes**: Modify schema, generate migrations, apply changes
- **Payment logic**: Update strategies in `payment-strategies/`  
- **API endpoints**: Add routes in `app/src/app/(server)/`
- **UI components**: Use existing shadcn/ui patterns in `components/`

### Testing
- Run E2E tests before major changes: `cd app && bun run e2e:test`
- Use Playwright UI for debugging: `bun run e2e:ui`
- Test SDK builds: `cd js-sdk && bun run build`

### Example Workflow: Adding a New Paid Tool

1.  **Define the business logic**: Create or modify a service in `app/src/lib/gateway/` that will perform the tool's action.
2.  **Update the database schema**: If the new tool requires new data to be stored, modify `app/src/lib/gateway/db/schema.ts`.
3.  **Generate and apply migrations**:
    ```bash
    cd app
    bun run db:generate-migrations
    bun run db:migrate
    ```
4.  **Create the API endpoint**: Add a new Next.js route handler in `app/src/app/(server)/api/` that uses `createPaidMcpHandler` from the SDK. Define the tool's name, pricing, and Zod schema for its inputs.
5.  **Write an E2E test**: Add a new test file in `app/tests/e2e/` to call the new tool and verify its behavior, including the `402 Payment Required` flow.
6.  **Run tests**:
    ```bash
    cd app
    bun run e2e:test
    ```

## Key Conventions

- **Package Manager**: Use `bun` exclusively (never npm/yarn/pnpm)
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Database**: All monetary amounts as base units with decimals metadata
- **Payments**: x402 pattern with structured payment requirements  
- **File Structure**: Follow Next.js 15 app router conventions
- **Type Safety**: Comprehensive TypeScript with Zod validation

## Important Notes

- **Monorepo structure**: App and SDK are separate workspaces
- **Payment security**: Never log sensitive payment details in production
- **Database migrations**: Always generate and review before applying
- **Multi-chain**: Architecture supports multiple blockchain networks
- **MCP integration**: Follows Model Context Protocol specifications
