![](/assets/gh_cover.png)

MCPay.fun lets clients (users, AI agents) make 

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

