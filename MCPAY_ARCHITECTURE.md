# MCPay Architecture Overview

MCPay is a payment layer for MCP (Model Context Protocol) servers and HTTP APIs that implements the **HTTP 402 Payment Required** status code with the **x402 pattern**. This document explains how the system works and its intended purpose through comprehensive Mermaid diagrams.

## Table of Contents
- [What MCPay Does](#what-mcpay-does)
- [High-Level System Architecture](#high-level-system-architecture)
- [Core x402 Payment Flow](#core-x402-payment-flow)
- [Repository Structure](#repository-structure)
- [Next.js App Architecture](#nextjs-app-architecture)
- [Database Schema Overview](#database-schema-overview)
- [Payment Strategy Architecture](#payment-strategy-architecture)
- [MCP Builder Flow](#mcp-builder-flow)
- [SDK/CLI Architecture](#sdkcli-architecture)
- [End-to-End User Journey](#end-to-end-user-journey)
- [Key Design Decisions](#key-design-decisions)
- [Security & Anti-Bot Features](#security--anti-bot-features)
- [Deployment Architecture](#deployment-architecture)
- [Future Roadmap Implications](#future-roadmap-implications)

## What MCPay Does

MCPay enables **micropayments for API calls** without subscriptions, manual API keys, or human sign-ups. It's designed for:
- **Developers**: Ship paid tools instantly without billing infrastructure
- **MCP Hosts**: Monetize each tool with per-call/per-token pricing
- **AI Agents**: Enable autonomous agent-to-service payments

## High-Level System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        A1[AI Agent/App]
        A2[MCP Client]
        A3[CLI Tool]
    end

    subgraph "MCPay Platform"
        B1[Next.js App]
        B2[Registry]
        B3[Builder]
        B4[Monetizer Proxy]
        B5[Payment APIs]
    end

    subgraph "External Services"
        C1[Blockchain Networks]
        C2[MCP Servers]
        C3[HTTP APIs]
        C4[Database]
        C5[GitHub OAuth]
    end

    A1 --> B4
    A2 --> B4
    A3 --> B4

    B1 --> B2
    B1 --> B3
    B1 --> B4
    B1 --> B5

    B4 --> C1
    B4 --> C2
    B4 --> C3
    B2 --> C4
    B1 --> C5

    style B4 fill:#e1f5fe
    style C1 fill:#f3e5f5
```

## Core x402 Payment Flow

The heart of MCPay is the x402 pattern that enables seamless micropayments:

```mermaid
sequenceDiagram
    participant Client as Client/Agent
    participant Proxy as MCPay Proxy
    participant Chain as Blockchain
    participant API as Target API/MCP
    participant DB as Database

    Note over Client, API: Standard x402 Payment Flow

    Client->>Proxy: ① HTTP Request (no payment)
    Proxy->>API: Check if endpoint requires payment
    API-->>Proxy: Tool pricing info

    alt Tool Requires Payment
        Proxy->>DB: Record payment requirement
        Proxy-->>Client: ② HTTP 402 + Payment Requirements<br/>{asset: "USDC", amount: "100000", destination: "0x..."}

        Client->>Chain: ③ Execute On-chain Payment
        Chain-->>Client: Payment confirmation

        Client->>Proxy: ④ Retry with X-PAYMENT header
        Proxy->>Chain: Verify payment on-chain
        Chain-->>Proxy: Payment verified

        Proxy->>DB: Record successful payment & analytics
        Proxy->>API: ⑤ Forward original request
        API-->>Proxy: API response
        Proxy-->>Client: ⑥ Return API response
    else Tool is Free
        Proxy->>API: Forward request directly
        API-->>Proxy: API response
        Proxy-->>Client: Return response
    end
```

## Repository Structure

```mermaid
graph TB
    subgraph "MCPay Repository"
        A[mcpay/]

        subgraph "Next.js Application"
            B[app/]
            B1[src/app/]
            B2[src/components/]
            B3[src/lib/gateway/]
            B4[public/]
            B5[scripts/]
        end

        subgraph "TypeScript SDK"
            C[js-sdk/]
            C1[src/client.ts]
            C2[src/handler.ts]
            C3[src/server.ts]
            C4[src/cli/]
            C5[src/x402/]
        end

        subgraph "Assets & Config"
            D[assets/]
            E[CLAUDE.md]
            F[README.md]
        end
    end

    A --> B
    A --> C
    A --> D
    A --> E
    A --> F

    B --> B1
    B --> B2
    B --> B3
    B --> B4
    B --> B5

    C --> C1
    C --> C2
    C --> C3
    C --> C4
    C --> C5
```

## Next.js App Architecture

```mermaid
graph TB
    subgraph "Next.js App Structure"
        subgraph "Route Handlers (/api)"
            A1[/api/servers<br/>Registry API]
            A2[/api/chat<br/>Builder Chat]
            A3[/api/analytics<br/>Usage Data]
            A4[/api/auth<br/>Authentication]
            A5[/api/users<br/>User Management]
        end

        subgraph "Core Routes"
            B1[/mcp/:id/*<br/>MCP Proxy]
            B2[/requirements<br/>Payment Requirements]
            B3[/validate<br/>Payment Validation]
            B4[/ping<br/>Server Discovery]
        end

        subgraph "UI Pages"
            C1[/<br/>Homepage]
            C2[/servers<br/>Registry Browse]
            C3[/build<br/>MCP Builder]
            C4[/register<br/>Server Registration]
        end

        subgraph "Backend Services"
            D1[Gateway Layer<br/>lib/gateway/]
            D2[Database<br/>Drizzle ORM]
            D3[Authentication<br/>Better-auth]
            D4[Payment Strategies<br/>CDP/Testing]
        end
    end

    A1 --> D1
    A2 --> D1
    A3 --> D1
    B1 --> D1
    B2 --> D1
    B3 --> D1

    D1 --> D2
    D1 --> D3
    D1 --> D4

    style B1 fill:#e3f2fd
    style B2 fill:#e8f5e8
    style B3 fill:#e8f5e8
```

## Database Schema Overview

```mermaid
erDiagram
    users {
        uuid id PK
        text wallet_address
        text name
        text email
        timestamp created_at
        timestamp updated_at
    }

    servers {
        uuid id PK
        text name
        text description
        text url
        jsonb tools
        uuid owner_id FK
        boolean public
        timestamp created_at
    }

    mcpTools {
        uuid id PK
        uuid server_id FK
        text name
        text description
        jsonb pricing
        timestamp created_at
    }

    payments {
        uuid id PK
        uuid user_id FK
        uuid server_id FK
        uuid tool_id FK
        numeric amount_raw
        integer token_decimals
        text currency
        text network
        text transaction_hash
        text status
        timestamp created_at
    }

    analytics {
        uuid id PK
        uuid server_id FK
        uuid tool_id FK
        integer total_calls
        numeric total_revenue_raw
        timestamp date
        timestamp updated_at
    }

    apiKeys {
        uuid id PK
        uuid user_id FK
        text key_hash
        text name
        boolean active
        timestamp created_at
    }

    users ||--o{ servers : owns
    servers ||--o{ mcpTools : contains
    users ||--o{ payments : makes
    servers ||--o{ payments : receives
    mcpTools ||--o{ payments : for
    servers ||--o{ analytics : tracked
    users ||--o{ apiKeys : owns
```

## Payment Strategy Architecture

```mermaid
graph TB
    subgraph "Payment Processing"
        A[Payment Request]

        subgraph "Strategy Selection"
            B1[CDP Strategy<br/>Coinbase Developer Platform]
            B2[Testing Strategy<br/>Mock Payments]
            B3[Future: Direct Wallet]
        end

        subgraph "Blockchain Networks"
            C1[Base Mainnet]
            C2[Base Sepolia]
            C3[SEI Testnet]
            C4[Other EVMs]
        end

        subgraph "Supported Tokens"
            D1[USDC]
            D2[EUROe]
            D3[Native ETH]
            D4[Custom Tokens]
        end

        subgraph "Settlement Process"
            E1[On-chain Verification]
            E2[Payment Recording]
            E3[Analytics Update]
            E4[Revenue Distribution]
        end
    end

    A --> B1
    A --> B2
    A --> B3

    B1 --> C1
    B1 --> C2
    B2 --> C2
    B3 --> C3

    C1 --> D1
    C2 --> D1
    C3 --> D2

    B1 --> E1
    B2 --> E1
    E1 --> E2
    E2 --> E3
    E3 --> E4

    style B1 fill:#e8f5e8
    style B2 fill:#fff3e0
```

## MCP Builder Flow

```mermaid
graph TB
    subgraph "MCPay Builder System"
        A[User starts chat at /build]

        subgraph "Chat Interface"
            B1[POST /api/chat]
            B2[MCP Client via HTTP Transport]
            B3[Tool Discovery & Testing]
            B4[Code Generation]
        end

        subgraph "Sandbox Environment"
            C1[Vercel Sandbox]
            C2[Live Preview]
            C3[Tool Testing]
            C4[Real-time Updates]
        end

        subgraph "Deployment"
            D1[GitHub Repository Creation]
            D2[Vercel Deployment]
            D3[MCPay Registration]
            D4[Monetization Setup]
        end

        subgraph "MCPay Build Server"
            E1[Template Generation]
            E2[Code Modification]
            E3[Tool Pricing Setup]
            E4[Production Deployment]
        end
    end

    A --> B1
    B1 --> B2
    B2 --> B3
    B3 --> B4

    B4 --> C1
    C1 --> C2
    C2 --> C3
    C3 --> C4

    C4 --> D1
    D1 --> D2
    D2 --> D3
    D3 --> D4

    B4 --> E1
    E1 --> E2
    E2 --> E3
    E3 --> E4

    style C1 fill:#e3f2fd
    style D2 fill:#e8f5e8
```

## SDK/CLI Architecture

```mermaid
graph TB
    subgraph "MCPay SDK Components"
        subgraph "Client SDK"
            A1[client.ts<br/>Payment Transport]
            A2[x402 Handler]
            A3[Wallet Integration]
            A4[Automatic Retries]
        end

        subgraph "Server SDK"
            B1[handler.ts<br/>NextJS Handler]
            B2[server.ts<br/>Stdio Proxy]
            B3[Tool Registration]
            B4[Pricing Configuration]
        end

        subgraph "CLI Tools"
            C1[mcpay server<br/>Proxy Command]
            C2[API Key Support]
            C3[Private Key Support]
            C4[Multi-server Support]
        end

        subgraph "x402 Implementation"
            D1[Payment Requirements]
            D2[Payment Validation]
            D3[Multi-chain Support]
            D4[Token Standards]
        end
    end

    A1 --> A2
    A2 --> A3
    A3 --> A4

    B1 --> B3
    B2 --> B3
    B3 --> B4

    C1 --> C2
    C1 --> C3
    C1 --> C4

    D1 --> D2
    D2 --> D3
    D3 --> D4

    A2 --> D1
    B1 --> D1

    style A1 fill:#e1f5fe
    style B1 fill:#e8f5e8
    style C1 fill:#fff3e0
```

## End-to-End User Journey

```mermaid
journey
    title MCPay User Journey
    section Discovery
      Browse Registry: 5: User
      Find MCP Server: 4: User
      View Tools & Pricing: 4: User
    section Integration
      Install SDK/CLI: 3: Developer
      Configure Payment: 3: Developer
      Test Connection: 4: Developer
    section Usage
      Call Paid Tool: 5: Agent
      Receive 402 Response: 3: Agent
      Execute Payment: 4: Agent
      Retry & Get Result: 5: Agent
    section Builder Flow
      Start Builder Chat: 5: Creator
      Generate MCP Server: 4: Creator
      Test in Sandbox: 4: Creator
      Deploy to Production: 5: Creator
      Monetize Tools: 5: Creator
```

## Key Design Decisions

### 1. **Monetary Precision**
All amounts stored as `NUMERIC(38,0)` base units with `token_decimals` to avoid floating-point errors:
- 0.1 USDC = `amount_raw: 100000, token_decimals: 6`
- 1.5 ETH = `amount_raw: 1500000000000000000, token_decimals: 18`

### 2. **x402 Pattern Implementation**
- Returns structured payment requirements in 402 responses
- Supports automatic retry with `X-PAYMENT` header
- Enables seamless agent-to-service payments

### 3. **Multi-Strategy Payment Processing**
- **CDP (Coinbase Developer Platform) Strategy**: Production-ready Coinbase integration
- **Testing Strategy**: Development/testing with mocks
- **Extensible**: Easy to add new payment methods

### 4. **MCP Protocol Integration**
- Full MCP JSON-RPC support over HTTP
- Tool discovery and pricing metadata
- Seamless proxy with payment enforcement

## Security & Anti-Bot Features

```mermaid
graph TB
    subgraph "Security Measures"
        A[Rate Limiting<br/>30 req/min per host]
        B[Request Throttling<br/>1sec minimum delay]
        C[Browser-like Headers<br/>Realistic User-Agents]
        D[Exponential Backoff<br/>429 response handling]
        E[Intelligent Caching<br/>Reduce upstream calls]
        F[API Key Authentication<br/>Managed access]
        G[Payment Verification<br/>On-chain validation]
        H[Header Scrubbing<br/>Remove sensitive data]
    end

    style A fill:#ffebee
    style B fill:#ffebee
    style F fill:#e8f5e8
    style G fill:#e8f5e8
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Production Deployment"
        A[Vercel Edge Functions]
        B[PostgreSQL Database]
        C[Redis KV Store]
        D[GitHub OAuth]

        subgraph "External APIs"
            E1[Coinbase CDP]
            E2[Blockchain RPCs]
            E3[MCP Servers]
        end

        subgraph "Monitoring"
            F1[Usage Analytics]
            F2[Revenue Tracking]
            F3[Error Logging]
        end
    end

    A --> B
    A --> C
    A --> D
    A --> E1
    A --> E2
    A --> E3
    A --> F1
    F1 --> F2
    F2 --> F3
```

## Future Roadmap Implications

The architecture is designed to support:
- **Multi-chain expansion**: Easy addition of new blockchain networks
- **Payment method diversity**: Credit cards, other cryptocurrencies
- **Advanced pricing models**: Dynamic pricing, tiered subscriptions
- **Enterprise features**: Bulk payments, usage quotas
- **Enhanced security**: Advanced rate limiting, fraud detection

This architecture enables MCPay to serve as a comprehensive payment infrastructure for the emerging ecosystem of AI agents and MCP servers, providing the foundation for a new economy of autonomous digital services.