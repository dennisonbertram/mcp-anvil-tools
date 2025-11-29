---
title: API Tools Reference
category: api
date: 2025-11-28
status: active
---

# API Tools Reference

Complete reference for all 11 MCP Anvil Tools.

## Reading Tools

### read_source

Reads Solidity source code from the Uniswap v4-core repository.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `path` | string | Yes | - | Path to file in v4-core (e.g., `src/PoolManager.sol`) |

**Example:**
```json
{
  "name": "read_source",
  "arguments": {
    "path": "src/PoolManager.sol"
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;..."
    }
  ]
}
```

---

### read_storage

Reads contract storage at a specific slot.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `address` | string | Yes | - | Contract address (0x...) |
| `slot` | string | Yes | - | Storage slot (hex or decimal) |
| `rpc` | string | No | `http://localhost:8545` | RPC endpoint |

**Example:**
```json
{
  "name": "read_storage",
  "arguments": {
    "address": "0x5fbdb2315678afecb367f032d93f642f64180aa3",
    "slot": "0x0"
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"address\":\"0x5fb...\",\"slot\":\"0x0\",\"value\":\"0x000...002a\"}"
    }
  ]
}
```

---

### read_bytecode

Gets deployed bytecode at an address.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `address` | string | Yes | - | Contract address (0x...) |
| `rpc` | string | No | `http://localhost:8545` | RPC endpoint |

**Example:**
```json
{
  "name": "read_bytecode",
  "arguments": {
    "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "rpc": "https://cloudflare-eth.com"
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"address\":\"0xA0b...\",\"bytecode\":\"0x6080604052...\"}"
    }
  ]
}
```

---

### read_events

Queries event logs from a contract.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `address` | string | Yes | - | Contract address |
| `event` | string | No | - | Event signature (e.g., `Transfer(address,address,uint256)`) |
| `fromBlock` | number/string | No | `latest - 100` | Start block |
| `toBlock` | number/string | No | `latest` | End block |
| `rpc` | string | No | `http://localhost:8545` | RPC endpoint |

**Note:** Maximum range is 10,000 blocks.

**Example:**
```json
{
  "name": "read_events",
  "arguments": {
    "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "event": "Transfer(address,address,uint256)",
    "fromBlock": 18000000,
    "toBlock": 18000100,
    "rpc": "https://cloudflare-eth.com"
  }
}
```

---

## Execution Tools

### simulate_tx

Simulates a transaction without broadcasting.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `to` | string | No | - | Target address (omit for deployment) |
| `from` | string | No | Test account | Sender address |
| `data` | string | No | `0x` | Calldata |
| `value` | string | No | `0` | ETH value in wei |
| `gas` | number | No | Auto | Gas limit |
| `rpc` | string | No | `http://localhost:8545` | RPC endpoint |

**Example:**
```json
{
  "name": "simulate_tx",
  "arguments": {
    "to": "0x5fbdb2315678afecb367f032d93f642f64180aa3",
    "data": "0x3fa4f245"
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"success\":true,\"result\":\"0x000...002a\",\"gasUsed\":\"21345\"}"
    }
  ]
}
```

---

### send_tx

Sends a transaction to the network.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `to` | string | No | - | Target address (omit for deployment) |
| `from` | string | No | Test account | Sender address |
| `data` | string | No | `0x` | Calldata |
| `value` | string | No | `0` | ETH value in wei |
| `gas` | number | No | Auto | Gas limit |
| `rpc` | string | No | `http://localhost:8545` | RPC endpoint |

**Example (Contract Deployment):**
```json
{
  "name": "send_tx",
  "arguments": {
    "data": "0x6080604052..."
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"transactionHash\":\"0x123...\",\"contractAddress\":\"0x5fb...\",\"gasUsed\":\"142567\"}"
    }
  ]
}
```

---

### impersonate

Impersonate any address on Anvil (local testing only).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `address` | string | Yes | - | Address to impersonate |
| `rpc` | string | No | `http://localhost:8545` | RPC endpoint |

**Security:** Only works on Anvil. Blocked on mainnet/testnet.

**Example:**
```json
{
  "name": "impersonate",
  "arguments": {
    "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
  }
}
```

---

### create_snapshot

Creates a state snapshot on Anvil.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `name` | string | No | Auto-generated | Snapshot name |
| `description` | string | No | - | Description |
| `rpc` | string | No | `http://localhost:8545` | RPC endpoint |

**Note:** Snapshots are lost on Anvil restart.

**Example:**
```json
{
  "name": "create_snapshot",
  "arguments": {
    "name": "before_attack",
    "description": "State before exploit simulation"
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"snapshotId\":\"0x1\",\"name\":\"before_attack\"}"
    }
  ]
}
```

---

### revert_snapshot

Reverts to a previous snapshot.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `snapshotId` | string | Yes | - | Snapshot ID from create_snapshot |
| `rpc` | string | No | `http://localhost:8545` | RPC endpoint |

**Example:**
```json
{
  "name": "revert_snapshot",
  "arguments": {
    "snapshotId": "0x1"
  }
}
```

---

## Tracing Tools

### trace_transaction

Traces an existing transaction by hash.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `txHash` | string | Yes | - | Transaction hash (0x...) |
| `tracer` | string | No | `callTracer` | Tracer type |
| `tracerConfig` | object | No | `{}` | Tracer-specific options |
| `rpc` | string | No | `http://localhost:8545` | RPC endpoint |

**Tracer Types:**
| Tracer | Description |
|--------|-------------|
| `callTracer` | Call hierarchy with gas, input, output |
| `prestateTracer` | Account state before execution |
| `4byteTracer` | Function selector statistics |
| (omit) | Raw opcode-level trace |

**Example:**
```json
{
  "name": "trace_transaction",
  "arguments": {
    "txHash": "0x1234567890abcdef...",
    "tracer": "callTracer",
    "tracerConfig": {
      "onlyTopCall": false
    }
  }
}
```

**Response (callTracer):**
```json
{
  "type": "CALL",
  "from": "0xf39...",
  "to": "0x5fb...",
  "gas": "0x5208",
  "gasUsed": "0x5208",
  "input": "0x3fa4f245",
  "output": "0x000...002a",
  "calls": [...]
}
```

---

### trace_call

Traces a call without sending a transaction.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `to` | string | Yes | - | Target contract address |
| `from` | string | No | Test account | Sender address |
| `data` | string | No | `0x` | Calldata |
| `value` | string | No | `0` | ETH value in wei |
| `tracer` | string | No | `callTracer` | Tracer type |
| `tracerConfig` | object | No | `{}` | Tracer options |
| `blockNumber` | string | No | `latest` | Block to trace at |
| `rpc` | string | No | `http://localhost:8545` | RPC endpoint |

**Example:**
```json
{
  "name": "trace_call",
  "arguments": {
    "to": "0x5fbdb2315678afecb367f032d93f642f64180aa3",
    "data": "0x3fa4f245",
    "tracer": "callTracer"
  }
}
```

---

## Error Handling

All tools return errors in a consistent format:

```json
{
  "content": [
    {
      "type": "text",
      "text": "[tool_name:ERROR_CODE] Error message"
    }
  ],
  "isError": true
}
```

**Common Error Codes:**
| Code | Description |
|------|-------------|
| `INVALID_ADDRESS` | Malformed Ethereum address |
| `INVALID_HASH` | Malformed transaction hash |
| `RPC_ERROR` | Failed to connect to RPC |
| `NOT_FOUND` | Transaction/contract not found |
| `ANVIL_ONLY` | Operation requires Anvil |

---

## Related Documents

- [Getting Started Guide](../guides/guide-getting-started-2025-11-28.md)
- [Configuration Reference](../reference/reference-configuration-2025-11-28.md)
- [Architecture Overview](../architecture/architecture-overview-2025-11-28.md)
