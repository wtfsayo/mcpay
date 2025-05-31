![](/assets/gh_cover.png)

**Developers** spend too much time wiring up Stripe, juggling API keys, and bolting on OAuth flows. **End-users** resent yet another monthly subscription—and machine users (LLMs, agents) can’t even click “subscribe.” What everyone really wants is **pay-per-use, on demand**.

The web has had a placeholder for exactly that since 1997: HTTP **402 Payment Required**. New specs such as **x402** finally activate that code, letting a server answer “402” with pricing metadata; the client (human browser or autonomous agent) pays in-flight—typically with a stable-coin—and immediately retries the request. No API key exchange, no checkout page. ([MDN Web Docs][1], [Coinbase][2])

## Proxy

## SDK

We have support for a JS SDK that you can install 

```sh
npm install mcpay
```

Alternatively you can also run it as a CLI

```sh

mcpay proxy --urls https://api.mcpay.fun/mcp/05599356-7a27-4519-872a-2ebb22467470 --private-key YOUR_PRIVATE_KEY

```

You can use it in Cursor and other MCP clients

```json
"financialdatasets.ai": {
    "command": "npx mcpay",
    "args": [
        "proxy",
        "--urls",
        "https://api.mcpay.fun/mcp/05599356-7a27-4519-872a-2ebb22467470",
        "--private-key",
        YOUR_PRIVATE_KEY
    ]
}
```

## Examples

We have some useful examples that might be interesting to experiment with

