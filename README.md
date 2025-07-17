![](/assets/gh_cover.png)

**Developers** often spend excessive time integrating payment solutions like Stripe, managing API keys, and implementing complex OAuth flows. **End-users** are increasingly wary of accumulating multiple monthly subscriptions, and **machine users** (such as LLMs and autonomous agents) typically cannot navigate traditional subscription sign-up processes. MCPay.fun addresses these challenges by enabling a straightforward **pay-per-use, on-demand** model for services and APIs.

The web has had a placeholder for monetizing web requests since 1997: the HTTP **402 Payment Required** status code. Emerging specifications like **x402** are now activating this standard. This allows a server to respond to a request with a "402" error, accompanied by metadata detailing the price of the requested resource. The client—whether a human-operated browser or an autonomous agent—can then programmatically make an in-flight payment (typically using a stablecoin like USDC) and immediately retry the original request. This flow eliminates the need for pre-exchanged API keys or traditional checkout pages, streamlining access for all types of users and enabling new microtransaction-based business models. ([MDN Web Docs][1], [Coinbase][2])

#### 3. Architecture

The following diagram illustrates the MCPay.fun workflow:
```
                            ┌──────────────┐
                            │    Client    │
                            │ (app/agent)  │
                            └──────┬───────┘
                ①  unauthenticated │ HTTP request
                                   ▼
        ┌─────────────────────────────────────────────┐
        │              MCP Proxy (Edge)               │
        │  • replies 402 + price metadata             │
        │  • signs & broadcasts payment               │
        │  • retries request once payment confirmed   │
        └──────┬──────────────┬───────────────────────┘
               │              │
               │② on-chain    │③ original request
               │   payment    │   (after pay)
               ▼              ▼
        ┌──────────────┐  ┌──────────────┐
        │  Blockchain   │  │   Your API   │
        │ (USDC/EUROe)  │  │ (any stack)  │
        └──────┬────────┘  └──────────────┘
               │
               │④ streamed usage & revenue events
               ▼
           (dashboard / analytics)

```


## Proxy

The MCPay proxy service is a key component of the architecture. It sits between the client (app/agent) and your API. Its responsibilities include:

- Intercepting unauthenticated HTTP requests.
- Replying with a 402 Payment Required status and price metadata if payment is needed.
- Handling the on-chain payment process (signing and broadcasting).
- Retrying the original request to your API once the payment is confirmed.

The proxy can be run using the MCPay CLI.

## SDK

We provide a JavaScript/TypeScript SDK for interacting with MCPay.

- **Installation**: You can install the SDK into your project using npm/pnpm/yarn:
  ```sh
  npm install mcpay
  # or
  pnpm install mcpay
  # or
  yarn add mcpay
  ```
- **Features**:
    - Connect to multiple MCP servers.
    - Automatic handling of 402 Payment Required responses using the x402 protocol.
    - Programmatic API for integration into your applications.
- **CLI Tool**: The SDK also includes a CLI tool for quickly setting up and running MCPay proxy servers.

For more detailed information, usage examples, and the API reference, please see the [js-sdk/README.md](./js-sdk/README.md).

## CLI

The MCPay CLI, included with the `mcpay` npm package (see SDK section), allows you to easily run the proxy server from your terminal. This is useful for quickly enabling MCPay for existing APIs or for development and testing.

**Example: Run the proxy for a single API endpoint:**
```sh
mcpay proxy --urls https://your-api.example.com/mcp/some-uuid --private-key YOUR_WALLET_PRIVATE_KEY
```

This command starts a local proxy that will handle 402 payments for requests directed to `https://your-api.example.com/mcp/some-uuid`.

**Integration with clients like Cursor:**

You can also configure tools like Cursor to use the MCPay CLI as a proxy for specific services:
```json
"financialdatasets.ai": {
    "command": "npx mcpay",
    "args": [
        "proxy",
        "--urls",
        "https://api.mcpay.fun/mcp/05599356-7a27-4519-872a-2ebb22467470", // Target service URL
        "--private-key",
        "YOUR_PRIVATE_KEY" // Your private key or reference to an env variable
    ]
}
```
For more detailed information on the CLI, its commands, and options, please see the [js-sdk/README.md#cli-usage](./js-sdk/README.md#cli-usage).

## Examples

We have some useful examples in the `mcp-examples` directory that might be interesting to experiment with:
- `mcp-examples/financialdatasets.ai/`: An example demonstrating integration with financialdatasets.ai.
- `mcp-examples/premium-weather/`: An example showcasing a premium weather API.

## Project Structure

This repository is a monorepo containing the following main packages:

- **`backend/`**: Contains the backend service for MCPay. ([backend/README.md](./backend/README.md))
- **`frontend/`**: Contains the frontend application for MCPay. ([frontend/README.md](./frontend/README.md))
- **`js-sdk/`**: The JavaScript/TypeScript SDK and CLI. ([js-sdk/README.md](./js-sdk/README.md))
- **`mcp-examples/`**: Example implementations using MCPay.

## How it Works

MCPay.fun leverages the x402 protocol to enable per-request payments for API and service access. Here's a simplified overview of the core concepts:

- **x402 Protocol**: When a client requests a protected resource, the MCPay proxy (or an MCPay-enabled server) can respond with an HTTP 402 Payment Required status. This response includes metadata specifying the payment amount and supported (crypto)currencies/tokens (e.g., USDC on Base).
- **Client-Side Payment**: The client (or the MCPay JS SDK integrated into the client) then constructs and signs a transaction for the required amount using a wallet associated with a private key.
- **Payment Verification**: The transaction is broadcast to the blockchain. Once confirmed, proof of payment is sent back to the proxy/server with the retried request.
- **Access Granted**: If the payment is valid, the proxy/server processes the original request and returns the resource.
- **Model Context Protocol (MCP)**: While x402 handles the payment layer, MCP (though not strictly required by all x402 implementations) can define how clients and servers communicate capabilities, context, and other information, especially relevant for AI model interactions. MCPay tools are designed to work smoothly within such ecosystems.

## Getting Started (High-Level)

1.  **Clone the Repository**:
    ```sh
    git clone https://github.com/your-username/mcpay.fun.git # Replace with actual repo URL
    cd mcpay.fun
    ```
2.  **Explore the SDK & CLI**: The `js-sdk/` is a good starting point. Its [README](./js-sdk/README.md) details how to use the SDK in your applications or the CLI to proxy existing services.
3.  **Run the Examples**: Check out the `mcp-examples/` directory to see practical applications.
4.  **Set up Local Development (Optional)**:
    *   For the backend server, see instructions in `backend/README.md`.
    *   For the frontend application, see `frontend/README.md`.
5.  **Provide a Private Key**: For making actual payments (even on testnets), the MCPay proxy/CLI will require access to a private key. This key controls the wallet used to send payments. **Manage this key securely, for example, using environment variables.**

## Contributing

Contributions are welcome! If you'd like to contribute, please feel free to fork the repository, make your changes, and submit a pull request. For major changes, please open an issue first to discuss what you would like to change.

(Consider adding a `CONTRIBUTING.md` file with more detailed guidelines in the future.)

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---


[1]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/402?utm_source=chatgpt.com "402 Payment Required - HTTP - MDN Web Docs - Mozilla"
[2]: https://www.coinbase.com/developer-platform/discover/launches/x402?utm_source=chatgpt.com "Introducing x402: a new standard for internet-native payments"
[3]: https://www.x402.org/x402-whitepaper.pdf?utm_source=chatgpt.com "[PDF] x402-whitepaper.pdf"
[4]: https://nftnow.com/news/exclusive-foundation-announces-dynamic-nft-pricing-feature/?utm_source=chatgpt.com "Exclusive: Foundation Announces Dynamic NFT Pricing Feature"
[5]: https://www.talentprotocol.com/?utm_source=chatgpt.com "Talent Protocol - What's your Builder Score?"