---
title: MCP Anvil Tools Architecture Overview
category: architecture
date: 2025-11-28
status: active
authors: Claude + Dennison
---

# MCP Anvil Tools Architecture Overview

## Overview

MCP Anvil Tools is a Model Context Protocol (MCP) server providing Ethereum development and testing tools for AI agents. It enables AI-powered smart contract auditing, testing workflows, and blockchain development automation.

## System Architecture

```
                    ┌─────────────────────┐
                    │   AI Agent / User   │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
       ┌──────▼──────┐  ┌──────▼──────┐  ┌─────▼─────┐
       │   HTTP/SSE  │  │    stdio    │  │  Claude   │
       │  Transport  │  │  Transport  │  │  Desktop  │
       └──────┬──────┘  └──────┬──────┘  └─────┬─────┘
              │                │                │
              └────────────────┼────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │     MCP Server      │
                    │   (Express + SDK)   │
                    └──────────┬──────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
  ┌──────▼──────┐       ┌──────▼──────┐      ┌──────▼──────┐
  │   Reading   │       │  Execution  │      │   Tracing   │
  │    Tools    │       │    Tools    │      │    Tools    │
  └──────┬──────┘       └──────┬──────┘      └──────┬──────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │        viem         │
                    │   (Ethereum RPC)    │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
       ┌──────▼──────┐  ┌──────▼──────┐  ┌─────▼─────┐
       │    Anvil    │  │   Mainnet   │  │  Testnet  │
       │  (Local)    │  │    RPC      │  │    RPC    │
       └─────────────┘  └─────────────┘  └───────────┘
```

## Transport Modes

### HTTP/SSE Mode (`npm start`)

For web clients and multi-agent systems:

- **Express server** handles HTTP requests
- **Server-Sent Events** for MCP protocol streaming
- **Session management** via query parameter `sessionId`
- **Endpoints**: `/sse`, `/messages`, `/health`, `/metrics`

**Use cases:**
- Web-based AI clients
- Multi-agent architectures
- RESTful integrations
- Persistent connections

### stdio Mode (`npm run start:stdio`)

For CLI tools and Claude Desktop:

- **JSON-RPC** over stdin/stdout
- **One message per line** protocol
- **Logs to stderr** to keep stdout clean
- **No HTTP server** overhead

**Use cases:**
- Claude Desktop integration
- Command-line MCP clients
- Shell script automation
- Programmatic testing

## Core Components

### Entry Point (`src/index.ts`)

Detects transport mode via `--stdio` flag:

```typescript
const args = process.argv.slice(2);
if (args.includes('--stdio')) {
  // stdio transport
} else {
  // HTTP/SSE transport
}
```

### Server (`src/server.ts`)

Express application with MCP SDK integration:

- **Health endpoint**: `GET /health` - Server status
- **Metrics endpoint**: `GET /metrics` - Statistics
- **SSE endpoint**: `GET /sse` - MCP transport
- **Messages endpoint**: `POST /messages` - MCP requests

### Tools Organization

```
src/tools/
├── index.ts       # Tool registration with MCP SDK
├── reading.ts     # read_source, read_storage, read_bytecode, read_events
├── execution.ts   # simulate_tx, send_tx, impersonate, snapshots
└── tracing.ts     # trace_transaction, trace_call
```

### Tool Categories

**Reading Tools (4 tools)**
| Tool | Purpose |
|------|---------|
| `read_source` | Read Solidity source from v4-core |
| `read_storage` | Read contract storage slots |
| `read_bytecode` | Get deployed bytecode |
| `read_events` | Query event logs |

**Execution Tools (5 tools)**
| Tool | Purpose |
|------|---------|
| `simulate_tx` | Simulate transaction without sending |
| `send_tx` | Send actual transaction |
| `impersonate` | Impersonate address (Anvil only) |
| `create_snapshot` | Create state snapshot |
| `revert_snapshot` | Revert to snapshot |

**Tracing Tools (2 tools)**
| Tool | Purpose |
|------|---------|
| `trace_transaction` | Trace existing tx by hash |
| `trace_call` | Trace call without sending |

## Data Flow

### Request Flow

```
1. Client connects (HTTP/SSE or stdio)
2. MCP initialize handshake
3. Client requests tools/list
4. Server returns available tools
5. Client calls tool with arguments
6. Tool handler executes via viem
7. Response returned to client
```

### Tool Execution Flow

```
1. MCP SDK receives tools/call request
2. Request validated against Zod schema
3. Tool handler invoked with validated args
4. viem client makes RPC call to Ethereum
5. Response formatted and returned
6. Errors wrapped in ToolError class
```

## State Management

### SQLite Database

Schema tables:
- `deployments` - Contract deployment records
- `anvil_instances` - Running Anvil instances
- `audit_sessions` - Session metadata
- `audit_findings` - Vulnerabilities found
- `audit_notes` - Session notes

### In-Memory State

- Snapshot registry for quick lookups
- viem client pool for connection reuse
- Session tracking for HTTP/SSE mode

## Key Patterns

### Singleton Pattern

Configuration and state managers use singletons:

```typescript
let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}
```

### Zod Validation

All tool inputs validated:

```typescript
const TraceTransactionSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  tracer: z.enum(['callTracer', 'prestateTracer', '4byteTracer']).optional(),
  tracerConfig: z.record(z.unknown()).optional(),
  rpc: z.string().url().optional().default('http://localhost:8545'),
});
```

### Error Handling

Custom error class for consistent responses:

```typescript
export class ToolError extends Error {
  constructor(
    public readonly tool: string,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(`[${tool}:${code}] ${message}`);
  }
}
```

## Security Considerations

- **Impersonation**: Only works on Anvil, blocked on production networks
- **Private Keys**: Never logged or exposed in responses
- **RPC Access**: Supports custom RPC URLs for authentication
- **Input Validation**: All inputs validated with Zod schemas
- **Gas Limits**: Configurable to prevent DoS scenarios

## Performance

- **Connection Pooling**: viem clients reused across requests
- **State Caching**: SQLite for fast state retrieval
- **Snapshot Registry**: In-memory for quick operations
- **Concurrent Requests**: Express handles multiple connections

## Related Documents

- [API Tools Reference](../api/api-tools-reference-2025-11-28.md)
- [Configuration Reference](../reference/reference-configuration-2025-11-28.md)
- [Getting Started Guide](../guides/guide-getting-started-2025-11-28.md)
