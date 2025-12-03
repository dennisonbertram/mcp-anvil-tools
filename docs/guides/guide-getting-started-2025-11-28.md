---
title: Guide: Getting Started with MCP Anvil Tools
category: guide
date: 2025-11-28
difficulty: beginner
estimated_time: 10 minutes
---

# Getting Started with MCP Anvil Tools

## Overview

This guide walks you through installing, configuring, and running MCP Anvil Tools for Ethereum development and testing.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Foundry Anvil installed (optional, for local testing)
- Git for cloning the repository

## Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/dennisonbertram/mcp-anvil-tools.git
cd mcp-anvil-tools
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Build the Project

```bash
npm run build
```

**Expected result:** `dist/` folder created with compiled JavaScript

### Step 4: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# Required
AUDIT_MCP_PORT=3000

# Optional - for mainnet interactions
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
ETHERSCAN_API_KEY=your_etherscan_api_key
```

## Running the Server

### HTTP Mode (for web clients)

```bash
npm start
```

Server runs at `http://localhost:3000` with MCP endpoint at `/mcp`

**Verify it's working:**

```bash
curl http://localhost:3000/health
# Returns: {"status":"ok","version":"1.0.0","timestamp":"..."}
```

### stdio Mode (for Claude Desktop)

```bash
npm run start:stdio
```

Communicates via stdin/stdout for CLI integration.

### Development Mode (with hot reload)

```bash
npm run dev
```

## Quick Test

### 1. Check Server Health

```bash
curl http://localhost:3000/health
```

### 2. Test MCP Endpoint

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

You should see a list of 11 available tools.

### 3. Start Anvil (Optional)

If you want to test locally:

```bash
anvil
```

Runs local Ethereum node at `http://localhost:8545`

## Available Tools

| Category | Tools |
|----------|-------|
| Reading | `read_source`, `read_storage`, `read_bytecode`, `read_events` |
| Execution | `simulate_tx`, `send_tx`, `impersonate`, `create_snapshot`, `revert_snapshot` |
| Tracing | `trace_transaction`, `trace_call` |

## Troubleshooting

### Problem: Server won't start

**Symptom:** Error on `npm start`

**Solution:**
1. Check port availability: `lsof -i :3000`
2. Verify `.env` file exists
3. Ensure `npm run build` completed

### Problem: Anvil connection fails

**Symptom:** Tool returns RPC error

**Solution:**
1. Ensure Anvil is running: `anvil`
2. Check port 8545 is available
3. Verify RPC URL in tool arguments

## Next Steps

- [Claude Desktop Integration](./guide-claude-desktop-2025-11-28.md)
- [API Tools Reference](../api/api-tools-reference-2025-11-28.md)
- [Configuration Reference](../reference/reference-configuration-2025-11-28.md)

## Related Documents

- [Architecture Overview](../architecture/architecture-overview-2025-11-28.md)
