---
title: Guide: Claude Desktop Integration
category: guide
date: 2025-11-28
difficulty: intermediate
estimated_time: 15 minutes
---

# Claude Desktop Integration

## Overview

This guide shows how to integrate MCP Anvil Tools with Claude Desktop for AI-powered Ethereum development.

## Prerequisites

- MCP Anvil Tools installed and built
- Claude Desktop application installed
- Absolute path to the mcp-anvil-tools directory

## Configuration

### Step 1: Locate Config File

**macOS:**
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```bash
~/.config/Claude/claude_desktop_config.json
```

### Step 2: Edit Configuration

Add the MCP server configuration:

```json
{
  "mcpServers": {
    "anvil-tools": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcp-anvil-tools/dist/index.js",
        "--stdio"
      ],
      "env": {
        "AUDIT_MCP_PORT": "3000",
        "MAINNET_RPC_URL": "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY",
        "ETHERSCAN_API_KEY": "your_etherscan_api_key"
      }
    }
  }
}
```

**Important:**
- Use **absolute paths** (not relative)
- Include the `--stdio` flag
- Add your own API keys

### Step 3: Restart Claude Desktop

Close and reopen Claude Desktop for changes to take effect.

## Verification

### Check Server Availability

In Claude Desktop, you should see "anvil-tools" listed in available MCP servers.

### Test a Tool

Ask Claude:

> "Use the read_bytecode tool to get the bytecode at address 0x..."

Claude should be able to call the tool and return results.

## Example Prompts

### Read Contract Storage

> "Read storage slot 0 of the contract at 0x5fbdb2315678afecb367f032d93f642f64180aa3 on my local Anvil"

### Trace a Transaction

> "Trace this transaction with callTracer: 0x1234..."

### Create Snapshot

> "Create a snapshot called 'before-test' on Anvil"

### Simulate Transaction

> "Simulate calling the transfer function on this ERC20 contract"

## Troubleshooting

### Problem: Tools not appearing

**Symptom:** Claude doesn't see anvil-tools

**Solutions:**
1. Verify the path in config is absolute and correct
2. Check that `dist/index.js` exists (run `npm run build`)
3. Restart Claude Desktop completely

### Problem: Tool execution errors

**Symptom:** Tools return errors

**Solutions:**
1. Check environment variables are set correctly
2. Verify Anvil is running if using local tools
3. Check RPC URLs are valid

### Problem: stdio communication issues

**Symptom:** No response from tools

**Solutions:**
1. Ensure `--stdio` flag is included
2. Check there are no console.log statements polluting stdout
3. Verify Node.js version is 18+

## Advanced Configuration

### Multiple Networks

Configure multiple RPC endpoints:

```json
{
  "mcpServers": {
    "anvil-tools": {
      "command": "node",
      "args": [
        "/path/to/mcp-anvil-tools/dist/index.js",
        "--stdio"
      ],
      "env": {
        "MAINNET_RPC_URL": "https://eth-mainnet...",
        "SEPOLIA_RPC_URL": "https://eth-sepolia...",
        "ARBITRUM_RPC_URL": "https://arb-mainnet..."
      }
    }
  }
}
```

### Custom Anvil Port Range

```json
{
  "env": {
    "ANVIL_PORT_START": "8545",
    "ANVIL_PORT_END": "8555"
  }
}
```

## Related Documents

- [Getting Started Guide](./guide-getting-started-2025-11-28.md)
- [Configuration Reference](../reference/reference-configuration-2025-11-28.md)
- [API Tools Reference](../api/api-tools-reference-2025-11-28.md)
