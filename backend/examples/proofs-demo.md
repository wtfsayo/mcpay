# VLayer Proofs API Demo

This document demonstrates how to use the MCPay.fun proofs API that integrates with VLayer for cryptographic verification of MCP tool executions.

## Overview

The proofs system provides:
- **Execution Verification**: AI-powered analysis of tool execution consistency
- **Cryptographic Proofs**: Web proofs using vlayer notary service
- **Reputation Scoring**: Server quality metrics based on verification history
- **Comprehensive Storage**: All verification data stored for audit trails

## API Endpoints

### 1. Create a Proof

Creates a verification proof for a tool execution.

```bash
curl -X POST http://localhost:3000/api/proofs \
  -H "Content-Type: application/json" \
  -d '{
    "toolId": "550e8400-e29b-41d4-a716-446655440000",
    "serverId": "550e8400-e29b-41d4-a716-446655440001", 
    "userId": "550e8400-e29b-41d4-a716-446655440002",
    "executionParams": {
      "symbol": "ETHUSDC"
    },
    "executionResult": {
      "symbol": "ETHUSDC",
      "status": "TRADING",
      "baseAsset": "ETH",
      "quoteAsset": "USDC",
      "price": "3420.50"
    },
    "executionUrl": "https://data-api.binance.vision/api/v3/exchangeInfo?symbol=ETHUSDC",
    "executionMethod": "GET",
    "executionHeaders": ["Content-Type: application/json"],
    "toolMetadata": {
      "name": "get_exchange_info",
      "description": "Get trading pair information",
      "parameters": [
        {
          "name": "symbol", 
          "type": "string",
          "description": "Trading pair symbol"
        }
      ]
    }
  }'
```

**Response:**
```json
{
  "proof": {
    "id": "proof-123",
    "toolId": "550e8400-e29b-41d4-a716-446655440000",
    "serverId": "550e8400-e29b-41d4-a716-446655440001",
    "isConsistent": true,
    "confidenceScore": "0.95",
    "webProofPresentation": "eyJwcmVzZW50YXRpb25Kc29uIjp7ImRhdGEiOiIwMTQwMDAwMD...",
    "aiEvaluation": "Execution verified successfully - all parameters provided and result format is valid",
    "status": "verified",
    "createdAt": "2025-01-31T23:26:37.655Z"
  },
  "verification": {
    "isConsistent": true,
    "confidenceScore": 0.95,
    "hasWebProof": true
  }
}
```

### 2. Get a Proof by ID

```bash
curl http://localhost:3000/api/proofs/proof-123
```

### 3. List All Proofs (with filters)

```bash
# Get all proofs
curl http://localhost:3000/api/proofs

# Filter by consistency
curl "http://localhost:3000/api/proofs?isConsistent=true&limit=20"

# Filter by verification type
curl "http://localhost:3000/api/proofs?verificationType=execution"
```

### 4. Get Proofs for a Tool

```bash
curl http://localhost:3000/api/tools/550e8400-e29b-41d4-a716-446655440000/proofs
```

### 5. Get Proofs for a Server

```bash
curl http://localhost:3000/api/servers/550e8400-e29b-41d4-a716-446655440001/proofs
```

### 6. Get Proof Statistics

```bash
# Overall stats
curl http://localhost:3000/api/proofs/stats

# Stats for a specific server
curl "http://localhost:3000/api/proofs/stats?serverId=550e8400-e29b-41d4-a716-446655440001"
```

**Response:**
```json
{
  "totalProofs": 150,
  "consistentProofs": 142,
  "inconsistentProofs": 8,
  "consistencyRate": 0.947,
  "avgConfidenceScore": 0.89,
  "proofsWithWebProof": 95,
  "webProofRate": 0.633,
  "verificationTypeStats": {
    "execution": 120,
    "replay": 25,
    "comparison": 5
  }
}
```

### 7. Re-verify a Proof

Re-runs verification on an existing proof to check for consistency.

```bash
curl -X POST http://localhost:3000/api/proofs/proof-123/verify
```

### 8. Get Server Reputation

Calculates reputation score based on recent verification history.

```bash
curl http://localhost:3000/api/servers/550e8400-e29b-41d4-a716-446655440001/reputation
```

**Response:**
```json
{
  "serverId": "550e8400-e29b-41d4-a716-446655440001",
  "reputationScore": 0.92,
  "totalProofs": 45,
  "consistentProofs": 42,
  "proofsWithWebProof": 30,
  "lastProofDate": "2025-01-31T23:26:37.655Z"
}
```

## VLayer Integration

### Web Proof Generation

When a tool execution includes a `executionUrl`, the system automatically:

1. **Generates Cryptographic Proof**: Uses vlayer's web-proof API to create tamper-proof evidence
2. **Notarization**: Leverages `https://test-notary.vlayer.xyz` for trusted attestation
3. **Storage**: Stores the full presentation data for later verification

Example web proof request sent to vlayer:
```json
{
  "url": "https://data-api.binance.vision/api/v3/exchangeInfo?symbol=ETHUSDC",
  "headers": ["Content-Type: application/json"],
  "notary": "https://test-notary.vlayer.xyz",
  "method": "GET"
}
```

### AI Verification

The system performs intelligent analysis:

- **Parameter Validation**: Checks if all required parameters are provided
- **Result Structure Validation**: Ensures response format is consistent
- **Consistency Analysis**: Compares execution against tool description
- **Confidence Scoring**: Provides 0-1 score based on verification quality

### Reputation Scoring

Server reputation is calculated using:
- **Consistency Rate**: Percentage of consistent executions
- **Web Proof Bonus**: +0.1 boost for cryptographically verified executions
- **Confidence Weighting**: Higher confidence scores improve reputation
- **Time Decay**: Recent proofs weighted more heavily

## Use Cases

### 1. MCP Server Quality Assurance

```bash
# Monitor a server's verification status
curl "http://localhost:3000/api/servers/server-123/proofs?limit=10"

# Check overall reputation
curl http://localhost:3000/api/servers/server-123/reputation
```

### 2. Tool Execution Auditing

```bash
# Audit a specific tool's execution history
curl "http://localhost:3000/api/tools/tool-456/proofs?limit=50"

# Get verification statistics
curl "http://localhost:3000/api/proofs/stats?toolId=tool-456"
```

### 3. User Trust Verification

```bash
# See all proofs generated by a user
curl http://localhost:3000/api/users/user-789/proofs

# Verify a suspicious execution
curl -X POST http://localhost:3000/api/proofs/proof-suspicious/verify
```

## Integration Example

Here's how to integrate proof generation into your MCP tool execution:

```typescript
import { VLayer, type ExecutionContext } from './lib/3rd-parties/vlayer.js';

async function executeToolWithProof(
  toolId: string, 
  serverId: string, 
  params: Record<string, any>,
  toolMetadata: any
) {
  // Execute the tool
  const result = await executeTool(params);
  
  // Create proof
  const proofResponse = await fetch('/api/proofs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      toolId,
      serverId,
      executionParams: params,
      executionResult: result,
      executionUrl: params.url, // if applicable
      toolMetadata
    })
  });
  
  const proofData = await proofResponse.json();
  
  return {
    result,
    proof: proofData.proof,
    verification: proofData.verification
  };
}
```

## Error Handling

The API returns appropriate HTTP status codes:

- `201`: Proof created successfully
- `400`: Invalid request data
- `404`: Proof/resource not found  
- `500`: Server error during verification

Example error response:
```json
{
  "error": "Tool with ID tool-123 not found"
}
```

## Security Considerations

- **Web Proofs**: Cryptographically secure and tamper-evident
- **Notary Trust**: Uses vlayer's trusted notary infrastructure
- **Data Integrity**: All execution data is hashed and stored
- **Audit Trail**: Complete verification history maintained
- **Replay Protection**: Timestamps prevent replay attacks 