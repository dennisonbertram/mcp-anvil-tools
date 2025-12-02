# MCP Anvil Tools

Model Context Protocol (MCP) server providing Ethereum development and testing tools for AI agents. Built on Anvil (Foundry's local Ethereum node) and viem for robust blockchain interactions.

## Overview

MCP Anvil Tools enables AI agents to:
- Read Solidity source code and contract storage
- Simulate and execute transactions on local Anvil or testnets
- Manipulate blockchain state with snapshots and impersonation
- Query events and decode bytecode
- Test smart contracts in isolated environments

Perfect for AI-powered smart contract auditing, testing workflows, and blockchain development automation.

## Key Features

- **Dual Transport Modes**: HTTP/SSE for web clients or stdio for CLI/desktop integration
- **Reading Tools**: Source code, storage, bytecode, and event log access
- **Execution Tools**: Transaction simulation, sending, and state manipulation
- **Tracing Tools**: Transaction and call tracing with multiple tracer types
- **Anvil Integration**: Automatic Anvil process management with snapshot/revert support
- **State Persistence**: SQLite-backed deployment and session tracking
- **Type Safety**: Full TypeScript support with Zod validation

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-anvil-tools.git
cd mcp-anvil-tools

# Install dependencies
npm install

# Build the project
npm run build
```

### Configuration

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

Required environment variables:
- `AUDIT_MCP_PORT` - Server port (default: 3000)
- `MAINNET_RPC_URL` - RPC endpoint for mainnet interactions
- `ETHERSCAN_API_KEY` - Optional, for source code verification

### Running the Server

**HTTP/SSE Mode** (for web clients, multi-agent systems):
```bash
npm start
# Server runs on http://localhost:3000
```

**stdio Mode** (for Claude Desktop, CLI tools):
```bash
npm run start:stdio
# Communicates via stdin/stdout
```

**Development Mode** (with hot reload):
```bash
npm run dev
```

## Transport Modes

### HTTP/SSE Mode

Use HTTP/SSE for:
- Web-based AI clients
- Multi-agent architectures
- Persistent connections with state management
- RESTful API interactions

**Endpoints:**
- `GET /health` - Health check (unauthenticated)
- `GET /metrics` - Deployment and instance statistics
- `GET /sse` - Server-Sent Events MCP transport
- `POST /messages` - MCP message handling

**Example Connection:**
```bash
# Health check
curl http://localhost:3000/health

# Metrics
curl http://localhost:3000/metrics

# SSE connection (requires MCP client)
curl -N http://localhost:3000/sse
```

### stdio Mode

Use stdio for:
- Claude Desktop integration
- Command-line MCP clients
- Programmatic testing
- Shell script automation

**Example Test:**
```bash
# Simple echo test
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | npm run start:stdio

# Automated test suite
npx tsx test-stdio.ts

# Manual test script
./test-stdio-manual.sh
```

## Available Tools

### Reading Tools

#### 1. `read_source`
Read Solidity source code files from the v4-core repository.

**Input:**
- `path` (string): Relative path from `lib/v4-core/src/` (e.g., `PoolManager.sol`)

**Output:**
- `content` (string): Full source code
- `lines` (number): Total line count
- `path` (string): Absolute file path
- `size` (number): File size in bytes
- `lastModified` (string): ISO timestamp

**Example:**
```json
{
  "path": "PoolManager.sol"
}
```

#### 2. `read_storage`
Read contract storage slots (persistent storage only, not transient).

**Input:**
- `address` (string): Contract address
- `slot` (string): Storage slot (hex, e.g., `0x0`)
- `blockTag` (optional): `latest`, `earliest`, `pending`, block number, or block hash
- `rpc` (optional): RPC URL (default: `http://localhost:8545`)

**Output:**
- `value` (string): Raw 32-byte hex value
- `decoded` (optional): Best-effort interpretation (uint256, address, bool, bytes32)

**Example:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "slot": "0x0",
  "blockTag": "latest"
}
```

#### 3. `read_bytecode`
Retrieve deployed bytecode from a contract address.

**Input:**
- `address` (string): Contract address
- `blockTag` (optional): Block identifier
- `rpc` (optional): RPC URL

**Output:**
- `bytecode` (string): Hex-encoded bytecode
- `size` (number): Bytecode size in bytes
- `codeHash` (string): Keccak256 hash
- `isEmpty` (boolean): True if no code deployed (EOA)

**Example:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

#### 4. `read_events`
Query and decode contract event logs.

**Input:**
- `address` (string): Contract address
- `eventSignature` (optional): Event signature (e.g., `Transfer(address,address,uint256)`)
- `topics` (optional): Indexed topics filter
- `fromBlock` (optional): Starting block (default: `earliest`)
- `toBlock` (optional): Ending block (default: `latest`)
- `rpc` (optional): RPC URL

**Output:**
- `events` (array): Event logs with block info
- `count` (number): Total events returned
- `fromBlock` (string): Actual starting block
- `toBlock` (string): Actual ending block

**Example:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "eventSignature": "Transfer(address,address,uint256)",
  "fromBlock": 1000000,
  "toBlock": 1000100
}
```

### Execution Tools

#### 5. `simulate_tx`
Simulate transactions without sending them to the network.

**Input:**
- `to` (string): Target contract address
- `data` (string): Calldata (hex)
- `from` (optional): Sender address
- `gasLimit` (optional): Gas limit
- `value` (optional): ETH value in wei (hex)
- `abi` (optional): Contract ABI for decoding
- `functionName` (optional): Function name for decoding
- `blockNumber` (optional): Block to simulate at
- `stateOverrides` (optional): State overrides by address
- `rpc` (optional): RPC endpoint

**Output:**
- `result` (string): Return data (hex)
- `decoded` (optional): Decoded return value
- `reverted` (boolean): Whether call reverted
- `revertReason` (optional): Decoded revert reason
- `revertData` (optional): Raw revert data

**Example:**
```json
{
  "to": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "data": "0x70a08231000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266",
  "abi": [...],
  "functionName": "balanceOf"
}
```

#### 6. `send_tx`
Send actual transactions to the network.

**Input:**
- `to` (optional): Target address (omit for deployment)
- `data` (string): Transaction data / bytecode
- `from` (optional): Sender address
- `value` (optional): ETH value in wei (hex)
- `gasLimit` (optional): Gas limit (auto-estimated)
- `gasPrice` (optional): Legacy gas price
- `maxFeePerGas` (optional): EIP-1559 max fee
- `maxPriorityFeePerGas` (optional): EIP-1559 priority fee
- `nonce` (optional): Transaction nonce
- `privateKey` (optional): Private key for signing
- `confirmations` (optional): Confirmations to wait (default: 1)
- `rpc` (optional): RPC endpoint

**Output:**
- `txHash` (string): Transaction hash
- `blockNumber` (string): Block number
- `blockHash` (string): Block hash
- `gasUsed` (string): Gas consumed
- `effectiveGasPrice` (string): Actual gas price
- `status` (enum): `success` or `reverted`
- `logs` (array): Event logs
- `contractAddress` (optional): Deployed contract address
- `from` (string): Sender address
- `to` (optional): Recipient address

**Example:**
```json
{
  "to": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "data": "0xa9059cbb...",
  "value": "0x0",
  "privateKey": "0x..."
}
```

#### 7. `impersonate`
Impersonate any address on Anvil (testing only).

**Input:**
- `address` (string): Address to impersonate
- `stopImpersonating` (optional): Stop impersonation (default: false)
- `rpc` (optional): RPC endpoint (must be Anvil)

**Output:**
- `success` (boolean): Whether operation succeeded
- `address` (string): Impersonated address
- `active` (boolean): Current impersonation status
- `balance` (optional): Current balance

**Example:**
```json
{
  "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
}
```

#### 8. `create_snapshot`
Create Anvil state snapshot for later revert.

**Input:**
- `name` (optional): Human-readable snapshot name
- `description` (optional): Snapshot description
- `rpc` (optional): RPC endpoint (must be Anvil)

**Output:**
- `snapshotId` (string): Unique snapshot identifier
- `name` (optional): Snapshot name
- `blockNumber` (number): Block at snapshot
- `blockHash` (string): Block hash
- `timestamp` (number): Block timestamp
- `created` (number): Unix timestamp created

**Example:**
```json
{
  "name": "before-attack-simulation",
  "description": "State before testing exploit scenario"
}
```

#### 9. `revert_snapshot`
Revert blockchain state to a previous snapshot.

**Input:**
- `snapshotId` (string): Snapshot ID or name
- `rpc` (optional): RPC endpoint (must be Anvil)

**Output:**
- `success` (boolean): Whether revert succeeded
- `snapshotId` (string): Reverted snapshot ID
- `blockNumber` (number): Block after revert
- `blockHash` (string): Block hash after revert
- `timestamp` (number): Block timestamp
- `reverted` (boolean): State revert confirmation

**Example:**
```json
{
  "snapshotId": "before-attack-simulation"
}
```

### Tracing Tools

#### 10. `trace_transaction`
Trace an existing transaction by hash using debug_traceTransaction.

**Input:**
- `txHash` (string): Transaction hash to trace (64 hex characters)
- `tracer` (optional): Tracer type - `callTracer`, `prestateTracer`, `4byteTracer`, or omit for raw opcode trace
- `tracerConfig` (optional): Tracer-specific configuration object
  - For `callTracer`: `{ onlyTopCall: true }` to exclude subcalls
- `rpc` (optional): RPC URL (default: `http://localhost:8545`)

**Output:**
- `result`: Trace result (format depends on tracer type)
  - **callTracer**: Call tree with `type`, `from`, `to`, `value`, `gas`, `input`, `output`
  - **prestateTracer**: Pre-execution state of all touched accounts
  - **4byteTracer**: Map of function selectors to call counts
  - **No tracer**: Full opcode trace with `structLogs` array
- `txHash` (string): Transaction hash that was traced

**Example:**
```json
{
  "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "tracer": "callTracer",
  "tracerConfig": {
    "onlyTopCall": true
  }
}
```

**Use Cases:**
- Debug failed transactions
- Analyze gas usage patterns
- Understand contract interactions
- Detect reentrancy or complex call paths

#### 11. `trace_call`
Trace a call without sending transaction using debug_traceCall.

**Input:**
- `to` (string): Target contract address
- `data` (string): Calldata (hex encoded)
- `from` (optional): Sender address
- `value` (optional): ETH value in wei (hex)
- `blockTag` (optional): Block to trace at - `latest`, `earliest`, `pending`, `safe`, `finalized`, or block number
- `tracer` (optional): Tracer type (same as `trace_transaction`)
- `tracerConfig` (optional): Tracer configuration
- `rpc` (optional): RPC URL

**Output:**
- `result`: Trace result (format depends on tracer type, same as `trace_transaction`)

**Example:**
```json
{
  "to": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "data": "0xa9059cbb000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb922660000000000000000000000000000000000000000000000000de0b6b3a7640000",
  "from": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "tracer": "callTracer"
}
```

**Use Cases:**
- Debug before sending actual transactions
- Analyze call behavior at specific blocks
- Test state override scenarios
- Investigate potential exploits safely

## Claude Desktop Integration

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

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

**Important**: Use absolute paths for the `command` args. Restart Claude Desktop after configuration changes.

## Configuration

### Alchemy Multi-Network Support

Set `ALCHEMY_API_KEY` to enable access to any Alchemy-supported network without additional configuration:

```bash
ALCHEMY_API_KEY=your_alchemy_api_key
```

Use any [Alchemy network slug](https://docs.alchemy.com/reference/supported-chains) directly:

| Network | Slug |
|---------|------|
| Ethereum | `eth-mainnet`, `eth-sepolia` |
| Arbitrum | `arb-mainnet`, `arb-sepolia` |
| Optimism | `opt-mainnet`, `opt-sepolia` |
| Polygon | `polygon-mainnet`, `polygon-amoy` |
| Base | `base-mainnet`, `base-sepolia` |

New networks are supported automatically as Alchemy adds them - no code changes needed.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AUDIT_MCP_PORT` | HTTP server port | `3000` |
| `AUDIT_MCP_HOST` | HTTP server host | `0.0.0.0` |
| `AUDIT_MCP_DB_PATH` | SQLite database path | `./audit-mcp.db` |
| `ANVIL_PORT_START` | Anvil port range start | `8545` |
| `ANVIL_PORT_END` | Anvil port range end | `8555` |
| `ANVIL_DEFAULT_CHAIN_ID` | Default chain ID | `31337` |
| `ALCHEMY_API_KEY` | Alchemy API key (enables multi-network) | - |
| `MAINNET_RPC_URL` | Mainnet RPC (overrides Alchemy) | - |
| `SEPOLIA_RPC_URL` | Sepolia RPC (overrides Alchemy) | - |
| `ETHERSCAN_API_KEY` | Etherscan API key | - |
| `ARBISCAN_API_KEY` | Arbiscan API key | - |
| `LOG_LEVEL` | Logging level | `info` |
| `LOG_FILE` | Log file path | `./audit-mcp.log` |
| `SLITHER_PATH` | Path to Slither binary | `/usr/local/bin/slither` |
| `SOLC_PATH` | Path to Solc binary | `/usr/local/bin/solc` |

## Architecture

### Project Structure

```
src/
├── index.ts              # Entry point (HTTP/stdio mode detection)
├── server.ts             # Express and MCP server setup
├── config.ts             # Configuration management
├── anvil/
│   ├── manager.ts        # Anvil process lifecycle
│   └── types.ts          # Anvil-related types
├── state/
│   └── manager.ts        # SQLite state management
├── tools/
│   ├── index.ts          # Tool registration
│   ├── reading.ts        # Reading tools (source, storage, bytecode, events)
│   ├── execution.ts      # Execution tools (simulate, send, impersonate, snapshots)
│   └── tracing.ts        # Tracing tools (debug_traceTransaction, debug_traceCall)
└── utils/
    ├── errors.ts         # Error handling
    └── validation.ts     # Zod schemas
```

### Database Schema

SQLite tables for state persistence:

- **deployments** - Contract deployment records
- **anvil_instances** - Running Anvil instances
- **audit_sessions** - Audit session metadata
- **audit_findings** - Discovered vulnerabilities
- **audit_notes** - Session notes

### Transport Architecture

```
┌─────────────────┐
│  AI Agent/User  │
└────────┬────────┘
         │
    ┌────┴────┐
    │  HTTP   │  stdio
    │  /SSE   │  (stdin/stdout)
    └────┬────┘
         │
    ┌────┴────────┐
    │  MCP Server │
    └────┬────────┘
         │
    ┌────┴────────┐
    │   Tools     │
    │  (reading + │
    │  execution) │
    └────┬────────┘
         │
    ┌────┴────────┐
    │    viem +   │
    │    Anvil    │
    └─────────────┘
```

## Testing

### Automated Tests

```bash
# Run stdio transport tests
npx tsx test-stdio.ts

# Run all tool tests
npm test
```

### Manual Testing

```bash
# Test stdio transport
./test-stdio-manual.sh

# Test specific tools
npm run test:tools
```

### Example Workflows

**1. Read and analyze contract:**
```bash
# Read source
read_source { "path": "PoolManager.sol" }

# Get bytecode
read_bytecode { "address": "0x..." }

# Read storage
read_storage { "address": "0x...", "slot": "0x0" }
```

**2. Simulate and execute transaction:**
```bash
# Simulate first
simulate_tx {
  "to": "0x...",
  "data": "0x...",
  "abi": [...]
}

# If successful, send
send_tx {
  "to": "0x...",
  "data": "0x...",
  "privateKey": "0x..."
}
```

**3. Test with snapshots:**
```bash
# Create snapshot
create_snapshot { "name": "clean-state" }

# Run test transactions
send_tx { ... }

# Revert to clean state
revert_snapshot { "snapshotId": "clean-state" }
```

## Development

### Building

```bash
# Build TypeScript
npm run build

# Watch mode
npm run dev
```

### Linting

```bash
# Run ESLint
npm run lint

# Format code
npm run format
```

### Adding New Tools

1. Define input/output schemas with Zod in `src/tools/`
2. Implement handler function
3. Export tool in tools object
4. Register in `src/tools/index.ts`
5. Add documentation to TOOLS.md

## Security Considerations

- **Impersonation**: Only works on Anvil, not production networks
- **Private Keys**: Never log or expose private keys
- **RPC Access**: Use secure RPC endpoints with authentication
- **State Overrides**: Validate carefully to prevent unintended behavior
- **Gas Limits**: Always set reasonable gas limits to prevent DoS
- **Input Validation**: All inputs validated with Zod schemas

## Troubleshooting

### Common Issues

**Server won't start:**
- Check port availability: `lsof -i :3000`
- Verify environment variables in `.env`
- Check database permissions for `AUDIT_MCP_DB_PATH`

**Anvil connection fails:**
- Ensure Anvil is installed: `which anvil`
- Check port range configuration
- Verify no port conflicts

**Tool execution errors:**
- Check RPC endpoint availability
- Verify contract address exists
- Ensure sufficient gas for transactions
- Check impersonation is only used on Anvil

**stdio mode issues:**
- Ensure one JSON-RPC message per line
- Check stderr for log messages (stdout is for responses)
- Verify MCP protocol version compatibility

## Performance

- **Connection Pooling**: Reuses viem clients across requests
- **State Caching**: SQLite for fast state retrieval
- **Snapshot Registry**: In-memory tracking for quick snapshot operations
- **Concurrent Requests**: Express handles multiple concurrent MCP connections

## Roadmap

- [ ] Advanced analysis tools (Slither integration)
- [ ] Call graph visualization
- [ ] AST parsing utilities
- [ ] Multi-chain support
- [x] Enhanced trace analysis (debug_traceTransaction, debug_traceCall)
- [ ] Gas optimization suggestions
- [ ] Security pattern detection

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Update documentation
5. Submit a pull request

## License

MIT

## Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [viem Documentation](https://viem.sh/)
- [Foundry Anvil](https://book.getfoundry.sh/anvil/)
- [TOOLS.md](./TOOLS.md) - Detailed tool reference

## Support

- Issues: [GitHub Issues](https://github.com/yourusername/mcp-anvil-tools/issues)
- Documentation: [TOOLS.md](./TOOLS.md)
- Examples: See `test-tools.ts` for usage examples
