---
title: Configuration Reference
category: reference
date: 2025-11-28
status: active
---

# Configuration Reference

Complete reference for all configuration options in MCP Anvil Tools.

## Environment Variables

### Server Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AUDIT_MCP_PORT` | No | `3000` | HTTP server port |
| `NODE_ENV` | No | `development` | Environment mode |

### RPC Endpoints

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MAINNET_RPC_URL` | No | - | Ethereum mainnet RPC |
| `SEPOLIA_RPC_URL` | No | - | Sepolia testnet RPC |
| `ARBITRUM_RPC_URL` | No | - | Arbitrum mainnet RPC |
| `OPTIMISM_RPC_URL` | No | - | Optimism mainnet RPC |
| `BASE_RPC_URL` | No | - | Base mainnet RPC |

### API Keys

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ETHERSCAN_API_KEY` | No | - | For source code verification |
| `ALCHEMY_API_KEY` | No | - | Alchemy RPC authentication |
| `INFURA_API_KEY` | No | - | Infura RPC authentication |

### Anvil Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANVIL_PORT_START` | No | `8545` | Starting port for Anvil instances |
| `ANVIL_PORT_END` | No | `8555` | Ending port for Anvil instances |
| `ANVIL_FORK_URL` | No | - | Default fork URL for new instances |
| `ANVIL_BLOCK_TIME` | No | - | Block time in seconds (auto-mine if omitted) |

### Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_PATH` | No | `./data/audit.db` | SQLite database location |

## Example .env File

```bash
# Server
AUDIT_MCP_PORT=3000
NODE_ENV=production

# RPC Endpoints (add your keys)
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY

# API Keys
ETHERSCAN_API_KEY=your_etherscan_api_key
ALCHEMY_API_KEY=your_alchemy_api_key

# Anvil
ANVIL_PORT_START=8545
ANVIL_PORT_END=8555

# Database
DATABASE_PATH=./data/audit.db
```

## Claude Desktop Configuration

### macOS

Config location: `~/Library/Application Support/Claude/claude_desktop_config.json`

### Windows

Config location: `%APPDATA%\Claude\claude_desktop_config.json`

### Linux

Config location: `~/.config/Claude/claude_desktop_config.json`

### Configuration Structure

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

**Important Notes:**
- Use **absolute paths** only (no `~` or relative paths)
- Include the `--stdio` flag in args
- All env vars are optional but recommended

## Transport Modes

### HTTP/SSE Mode

```bash
npm start
# or
node dist/index.js
```

**Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/metrics` | GET | Server metrics |
| `/sse` | GET | SSE connection for MCP |
| `/messages` | POST | MCP message endpoint |

### stdio Mode

```bash
npm run start:stdio
# or
node dist/index.js --stdio
```

- JSON-RPC over stdin/stdout
- Logs output to stderr
- Required for Claude Desktop integration

## Zod Validation

All configuration is validated with Zod schemas at startup:

```typescript
const ConfigSchema = z.object({
  port: z.coerce.number().default(3000),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  mainnetRpcUrl: z.string().url().optional(),
  etherscanApiKey: z.string().optional(),
  anvilPortStart: z.coerce.number().default(8545),
  anvilPortEnd: z.coerce.number().default(8555),
  databasePath: z.string().default('./data/audit.db'),
});
```

Invalid configuration causes the server to fail at startup with descriptive error messages.

## Network Defaults

When `rpc` parameter is omitted from tool calls:

| Context | Default RPC |
|---------|-------------|
| Local development | `http://localhost:8545` |
| Configured mainnet | Value of `MAINNET_RPC_URL` |

## Security Considerations

1. **Never commit `.env` files** - Contains API keys
2. **Use environment variables** - Not hardcoded values
3. **Restrict Anvil ports** - Limit port range in production
4. **Impersonation blocked** - Only works on Anvil nodes

## Related Documents

- [Getting Started Guide](../guides/guide-getting-started-2025-11-28.md)
- [Claude Desktop Integration](../guides/guide-claude-desktop-2025-11-28.md)
- [API Tools Reference](../api/api-tools-reference-2025-11-28.md)
