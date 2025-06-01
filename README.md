![](/assets/gh_cover.png)

**Developers** spend too much time wiring up Stripe, juggling API keys, and bolting on OAuth flows. **End-users** resent yet another monthly subscription—and machine users (LLMs, agents) can’t even click “subscribe.” What everyone really wants is **pay-per-use, on demand**.

The web has had a placeholder for exactly that since 1997: HTTP **402 Payment Required**. New specs such as **x402** finally activate that code, letting a server answer “402” with pricing metadata; the client (human browser or autonomous agent) pays in-flight—typically with a stable-coin—and immediately retries the request. No API key exchange, no checkout page. ([MDN Web Docs][1], [Coinbase][2])

#### 3. Architecture

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



---


[1]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/402?utm_source=chatgpt.com "402 Payment Required - HTTP - MDN Web Docs - Mozilla"
[2]: https://www.coinbase.com/developer-platform/discover/launches/x402?utm_source=chatgpt.com "Introducing x402: a new standard for internet-native payments"
[3]: https://www.x402.org/x402-whitepaper.pdf?utm_source=chatgpt.com "[PDF] x402-whitepaper.pdf"
[4]: https://nftnow.com/news/exclusive-foundation-announces-dynamic-nft-pricing-feature/?utm_source=chatgpt.com "Exclusive: Foundation Announces Dynamic NFT Pricing Feature"
[5]: https://www.talentprotocol.com/?utm_source=chatgpt.com "Talent Protocol - What's your Builder Score?"