# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP (Model Context Protocol) server providing Ethereum development and testing tools for AI agents. Built on Anvil (Foundry's local Ethereum node) and viem for blockchain interactions. Enables AI-powered smart contract auditing, testing workflows, and blockchain development automation.

## Commands

```bash
# Install and build
npm install
npm run build

# Run server
npm start              # HTTP/SSE mode (web clients)
npm run start:stdio    # stdio mode (Claude Desktop)
npm run dev            # Development with hot reload

# Testing
npm test               # Run Vitest tests
npx tsx test-stdio.ts  # Test stdio transport

# Quality
npm run lint           # ESLint
npm run format         # Prettier
```

## Architecture

### Transport Modes
- **HTTP** (`npm start`): Express server with StreamableHTTPServerTransport, stateless MCP endpoint at `/mcp`, plus `/health` and `/metrics`
- **stdio** (`npm run start:stdio`): JSON-RPC over stdin/stdout for Claude Desktop integration

### Core Components

```
src/
├── index.ts          # Entry point, mode detection (--stdio flag)
├── server.ts         # Express app + MCP server setup
├── config.ts         # Zod-validated config from .env
├── anvil/
│   ├── manager.ts    # Anvil process lifecycle, port allocation
│   └── types.ts      # Anvil interfaces
├── state/
│   └── manager.ts    # SQLite state persistence (better-sqlite3)
├── tools/
│   ├── index.ts      # Tool registration with McpServer.registerTool()
│   ├── reading.ts    # read_source, read_storage, read_bytecode, read_events (4 tools)
│   ├── execution.ts  # simulate_tx, send_tx, impersonate, snapshots (5 tools)
│   └── tracing.ts    # trace_transaction, trace_call (2 tools)
└── utils/
    ├── errors.ts     # Custom error classes
    └── validation.ts # Zod schemas for tool inputs
```

### Key Patterns
- **Singleton pattern**: `getConfig()`, `getStateManager()` for shared instances
- **MCP SDK**: Uses `@modelcontextprotocol/sdk` McpServer class with `registerTool()` high-level API
- **Stateless transport**: StreamableHTTPServerTransport with no session management
- **Viem**: All blockchain interactions via viem (`createPublicClient`, `http` transport)
- **Zod validation**: All config and tool inputs validated with Zod schemas

### Database Schema (SQLite)
- `deployments` - Contract deployment records with ABI, source
- `anvil_instances` - Running Anvil instance tracking
- `audit_sessions` - Audit session metadata
- `audit_findings` - Discovered vulnerabilities
- `audit_notes` - Session notes

## Tool Categories

**Reading Tools (4)**: `read_source`, `read_storage`, `read_bytecode`, `read_events`
**Execution Tools (5)**: `simulate_tx`, `send_tx`, `impersonate`, `create_snapshot`, `revert_snapshot`
**Tracing Tools (2)**: `trace_transaction`, `trace_call`

**Total: 11 tools**

Tools requiring Anvil: `impersonate`, `create_snapshot`, `revert_snapshot`

## Key Implementation Details

- stdio mode logs to `console.error` to keep stdout clean for JSON-RPC
- Anvil port allocation from configurable range (default 8545-8555)
- Private keys redacted from Anvil output in logs
- Block range limit of 10k blocks for `read_events`
- Snapshots are lost on Anvil restart

## Configuration

Required env vars for non-Anvil networks:
- `MAINNET_RPC_URL` - Mainnet RPC endpoint
- `ETHERSCAN_API_KEY` - For source verification (optional)

See `.env.example` for all options.
