# MCP Anvil Tools - Quick Start

MCP server for Ethereum smart contract auditing with Anvil.

## Setup (2 minutes)

```bash
npm install && npm run build
cp .env.example .env
```

## Run

```bash
# HTTP mode (web clients)
npm start

# stdio mode (Claude Desktop)
npm run start:stdio
```

## Claude Desktop Config

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "anvil-tools": {
      "command": "node",
      "args": ["/path/to/mcp-anvil-tools/dist/index.js", "--stdio"]
    }
  }
}
```

---

## Tools at a Glance

| Tool | What it does |
|------|--------------|
| `read_source` | Read Solidity files from v4-core |
| `read_storage` | Read contract storage slots |
| `read_bytecode` | Get deployed bytecode |
| `read_events` | Query event logs |
| `simulate_tx` | Dry-run transactions |
| `send_tx` | Send real transactions |
| `impersonate` | Act as any address (Anvil only) |
| `create_snapshot` | Save blockchain state |
| `revert_snapshot` | Restore saved state |

---

## Usage Examples

### Read a contract

```json
{"tool": "read_source", "arguments": {"path": "PoolManager.sol"}}
```

### Check storage slot

```json
{
  "tool": "read_storage",
  "arguments": {
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "slot": "0x0"
  }
}
```

### Simulate a call

```json
{
  "tool": "simulate_tx",
  "arguments": {
    "to": "0x742d35Cc...",
    "data": "0x70a08231000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266"
  }
}
```

### Test with snapshots

```json
// Save state
{"tool": "create_snapshot", "arguments": {"name": "before-test"}}

// Run tests...

// Restore state
{"tool": "revert_snapshot", "arguments": {"snapshotId": "before-test"}}
```

### Impersonate an address

```json
// Act as any address (Anvil only)
{"tool": "impersonate", "arguments": {"address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"}}

// Send tx as that address (no private key needed)
{"tool": "send_tx", "arguments": {"to": "0x...", "data": "0x...", "from": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"}}
```

---

## Typical Audit Workflow

```
1. read_source       → Understand the code
2. read_bytecode     → Verify deployment
3. read_storage      → Inspect state
4. create_snapshot   → Save clean state
5. simulate_tx       → Test exploit hypothesis
6. send_tx           → Execute if simulation passes
7. read_events       → Check emitted events
8. revert_snapshot   → Reset for next test
```

---

## Key Points

- **Anvil required** for `impersonate`, `create_snapshot`, `revert_snapshot`
- **Simulate first** before sending real transactions
- **Snapshots reset** when Anvil restarts
- **Block range limit**: 10k blocks max for `read_events`
- **No transient storage**: `read_storage` only reads persistent slots

---

## Full Documentation

- [README.md](./README.md) - Complete setup guide
- [TOOLS.md](./TOOLS.md) - Detailed tool reference
