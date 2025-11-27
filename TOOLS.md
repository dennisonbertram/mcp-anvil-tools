# MCP Anvil Tools - Detailed Tool Reference

Complete reference documentation for all tools provided by the MCP Anvil Tools server.

## Table of Contents

### Reading Tools
1. [read_source](#1-read_source) - Read Solidity source files
2. [read_storage](#2-read_storage) - Read contract storage slots
3. [read_bytecode](#3-read_bytecode) - Get deployed bytecode
4. [read_events](#4-read_events) - Query contract events

### Execution Tools
5. [simulate_tx](#5-simulate_tx) - Simulate transactions
6. [send_tx](#6-send_tx) - Send transactions
7. [impersonate](#7-impersonate) - Impersonate addresses (Anvil only)
8. [create_snapshot](#8-create_snapshot) - Create state snapshots
9. [revert_snapshot](#9-revert_snapshot) - Revert to snapshots

---

## Reading Tools

### 1. read_source

Read Solidity source code files from the v4-core repository.

#### Description

Reads and returns the complete contents of a Solidity source file from the `lib/v4-core/src/` directory. Includes security measures to prevent path traversal attacks.

#### Input Schema

```typescript
{
  path: string  // Relative path from lib/v4-core/src/
}
```

**Field Details:**
- `path` (required): Relative path to the Solidity file
  - Must not start with `/`
  - Must not contain `..` for directory traversal
  - Examples: `"PoolManager.sol"`, `"libraries/Pool.sol"`

#### Output Schema

```typescript
{
  content: string      // Full source code content
  lines: number        // Total number of lines
  path: string         // Absolute path to the file
  size: number         // File size in bytes
  lastModified: string // ISO 8601 timestamp
}
```

#### Example Request

```json
{
  "tool": "read_source",
  "arguments": {
    "path": "PoolManager.sol"
  }
}
```

#### Example Response

```json
{
  "content": "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.24;\n\n...",
  "lines": 342,
  "path": "/Users/dev/audit-infra/lib/v4-core/src/PoolManager.sol",
  "size": 15234,
  "lastModified": "2024-11-27T10:30:00.000Z"
}
```

#### Error Codes

- `PATH_TRAVERSAL` - Attempted path traversal detected
- `FILE_NOT_FOUND` - File does not exist at specified path
- `READ_ERROR` - Failed to read file (permissions, disk error, etc.)

#### Common Use Cases

1. **Reading main contracts:**
   ```json
   {"path": "PoolManager.sol"}
   ```

2. **Reading libraries:**
   ```json
   {"path": "libraries/Pool.sol"}
   ```

3. **Reading interfaces:**
   ```json
   {"path": "interfaces/IPoolManager.sol"}
   ```

#### Security Notes

- Paths are validated using `realpath` to prevent symlink attacks
- All paths must be within `lib/v4-core/src/` directory
- Path traversal with `..` is blocked

---

### 2. read_storage

Read persistent storage slots from deployed contracts.

#### Description

Reads a 32-byte storage slot from a contract at a specific block. Attempts to decode the value as common types (uint256, address, bool). Note: This only reads persistent storage, not transient storage (TLOAD/TSTORE).

#### Input Schema

```typescript
{
  address: string              // Contract address (0x-prefixed, 40 hex chars)
  slot: string                 // Storage slot (hex, e.g., "0x0", "0x1")
  blockTag?: BlockTag          // Optional: "latest" | "earliest" | "pending" | number | hash
  rpc?: string                 // Optional: RPC URL (default: http://localhost:8545)
}
```

**Field Details:**
- `address` (required): Ethereum address in hex format
  - Must match: `/^0x[a-fA-F0-9]{40}$/`
  - Example: `"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"`

- `slot` (required): Storage slot identifier
  - Must match: `/^0x[a-fA-F0-9]+$/`
  - Examples: `"0x0"`, `"0x1"`, `"0xa"`, `"0x10"`

- `blockTag` (optional): Block to read from
  - String: `"latest"`, `"earliest"`, `"pending"`
  - Number: Block number (e.g., `1000000`)
  - String: Block hash (0x-prefixed)
  - Default: `"latest"`

- `rpc` (optional): RPC endpoint URL
  - Must be a valid URL
  - Default: `"http://localhost:8545"`

#### Output Schema

```typescript
{
  value: string    // Raw 32-byte hex value (0x-prefixed, 64 hex chars)
  decoded?: {      // Optional decoded interpretation
    type: "uint256" | "address" | "bool" | "bytes32"
    value: string | boolean
  }
}
```

**Decoded Types:**
- `uint256`: String representation of BigInt (preserves precision)
- `address`: Checksummed Ethereum address (if value is left-padded with zeros)
- `bool`: Boolean `true` or `false` (if value is 0 or 1)
- `bytes32`: Full 32-byte hex value (fallback)

#### Example Request

```json
{
  "tool": "read_storage",
  "arguments": {
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "slot": "0x0",
    "blockTag": "latest"
  }
}
```

#### Example Response - Address

```json
{
  "value": "0x000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045",
  "decoded": {
    "type": "address",
    "value": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
  }
}
```

#### Example Response - Uint256

```json
{
  "value": "0x00000000000000000000000000000000000000000000000000000000000003e8",
  "decoded": {
    "type": "uint256",
    "value": "1000"
  }
}
```

#### Example Response - Bool

```json
{
  "value": "0x0000000000000000000000000000000000000000000000000000000000000001",
  "decoded": {
    "type": "bool",
    "value": true
  }
}
```

#### Error Codes

- `RPC_ERROR` - Failed to connect to RPC or read storage

#### Common Use Cases

1. **Read contract owner:**
   ```json
   {
     "address": "0x...",
     "slot": "0x0"  // Owner typically at slot 0
   }
   ```

2. **Read balance mapping:**
   ```json
   {
     "address": "0x...",
     "slot": "0x..." // Computed slot for mapping[address]
   }
   ```

3. **Historical storage query:**
   ```json
   {
     "address": "0x...",
     "slot": "0x0",
     "blockTag": 1000000
   }
   ```

#### Important Notes

- **Transient Storage**: Cannot read transient storage (TLOAD/TSTORE). Use transaction tracing for that.
- **Storage Layout**: Requires knowledge of contract storage layout to compute correct slots
- **Mappings**: Use Solidity storage slot computation for mappings and dynamic arrays
- **Decoding**: Best-effort automatic decoding. For complex types, use the raw value.

---

### 3. read_bytecode

Retrieve deployed bytecode from a contract address.

#### Description

Fetches the bytecode deployed at a contract address. Returns the raw bytecode, size, code hash, and whether the address is an Externally Owned Account (EOA) with no code.

#### Input Schema

```typescript
{
  address: string              // Contract address
  blockTag?: BlockTag          // Optional: block identifier
  rpc?: string                 // Optional: RPC URL
}
```

**Field Details:**
- `address` (required): Ethereum address
  - Must match: `/^0x[a-fA-F0-9]{40}$/`

- `blockTag` (optional): Block to query
  - String: `"latest"`, `"earliest"`, `"pending"`
  - Number: Block number
  - Note: Block hash not supported (use block number instead)
  - Default: `"latest"`

- `rpc` (optional): RPC endpoint
  - Default: `"http://localhost:8545"`

#### Output Schema

```typescript
{
  bytecode: string   // Hex-encoded bytecode (0x-prefixed)
  size: number       // Bytecode size in bytes
  codeHash: string   // Keccak256 hash of bytecode
  isEmpty: boolean   // True if no code (EOA or not deployed)
}
```

#### Example Request

```json
{
  "tool": "read_bytecode",
  "arguments": {
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
  }
}
```

#### Example Response - Contract

```json
{
  "bytecode": "0x608060405234801561001057600080fd5b506004361061002b...",
  "size": 2456,
  "codeHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "isEmpty": false
}
```

#### Example Response - EOA

```json
{
  "bytecode": "0x",
  "size": 0,
  "codeHash": "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
  "isEmpty": true
}
```

#### Error Codes

- `UNSUPPORTED_BLOCK_TAG` - Block hash not supported (use block number)
- `RPC_ERROR` - Failed to retrieve bytecode from RPC

#### Common Use Cases

1. **Verify contract deployment:**
   ```json
   {
     "address": "0x..."
   }
   // Check isEmpty === false
   ```

2. **Compare bytecode across blocks:**
   ```json
   {
     "address": "0x...",
     "blockTag": 1000000
   }
   ```

3. **Check for proxy patterns:**
   ```json
   {
     "address": "0x..."
   }
   // Analyze bytecode for DELEGATECALL patterns
   ```

#### Analysis Tips

- **Empty Address**: `isEmpty: true` indicates EOA or non-deployed address
- **Code Hash**: Keccak256 hash can be used to compare bytecode across addresses
- **Proxy Detection**: Look for `DELEGATECALL` (0xf4) opcode in bytecode
- **Upgradeable**: Compare bytecode at different blocks to detect upgrades

---

### 4. read_events

Query and decode contract event logs within a block range.

#### Description

Fetches event logs from a contract, optionally filtered by event signature and indexed topics. Automatically decodes events if ABI signature is provided. Implements block range limits to prevent excessive queries.

#### Input Schema

```typescript
{
  address: string              // Contract address
  eventSignature?: string      // Optional: Event signature for filtering
  topics?: string[]            // Optional: Indexed topics filter
  fromBlock?: number | "earliest"  // Optional: Starting block (default: "earliest")
  toBlock?: number | "latest"      // Optional: Ending block (default: "latest")
  rpc?: string                     // Optional: RPC URL
}
```

**Field Details:**
- `address` (required): Contract address to query

- `eventSignature` (optional): Event ABI signature
  - Format: `"EventName(type1,type2,...)"`
  - Example: `"Transfer(address,address,uint256)"`
  - Used for filtering and automatic decoding

- `topics` (optional): Array of indexed topics
  - topic[0]: Event signature hash (keccak256)
  - topic[1-3]: Indexed event parameters
  - Example: `["0x...", "0x..."]`

- `fromBlock` (optional): Starting block
  - Number: Specific block number
  - String: `"earliest"`
  - Default: `"earliest"`

- `toBlock` (optional): Ending block
  - Number: Specific block number
  - String: `"latest"`
  - Default: `"latest"`

- `rpc` (optional): RPC endpoint
  - Default: `"http://localhost:8545"`

#### Output Schema

```typescript
{
  events: EventLog[]  // Array of event logs
  count: number       // Total number of events
  fromBlock: string   // Actual starting block queried
  toBlock: string     // Actual ending block queried
}

interface EventLog {
  blockNumber: string        // Block number as string
  blockHash: string          // Block hash
  transactionHash: string    // Transaction hash
  transactionIndex: number   // Transaction index in block
  logIndex: number          // Log index in transaction
  address: string           // Contract address (checksummed)
  topics: string[]          // Indexed event topics
  data: string              // Non-indexed event data
  decoded?: {               // Optional decoded event
    eventName: string
    args: Record<string, any>
  }
}
```

#### Example Request - Simple

```json
{
  "tool": "read_events",
  "arguments": {
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "fromBlock": 1000000,
    "toBlock": 1000100
  }
}
```

#### Example Request - With Signature

```json
{
  "tool": "read_events",
  "arguments": {
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "eventSignature": "Transfer(address,address,uint256)",
    "fromBlock": 1000000,
    "toBlock": 1001000
  }
}
```

#### Example Response

```json
{
  "events": [
    {
      "blockNumber": "1000042",
      "blockHash": "0x1234567890abcdef...",
      "transactionHash": "0xabcdef1234567890...",
      "transactionIndex": 5,
      "logIndex": 2,
      "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "topics": [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        "0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266",
        "0x00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8"
      ],
      "data": "0x00000000000000000000000000000000000000000000000000000000000003e8",
      "decoded": {
        "eventName": "Transfer",
        "args": {
          "from": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
          "to": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          "value": "1000"
        }
      }
    }
  ],
  "count": 1,
  "fromBlock": "1000000",
  "toBlock": "1001000"
}
```

#### Error Codes

- `BLOCK_RANGE_TOO_LARGE` - Block range exceeds 10,000 blocks
- `RPC_ERROR` - Failed to query events from RPC

#### Common Use Cases

1. **All events from contract:**
   ```json
   {
     "address": "0x...",
     "fromBlock": 1000000,
     "toBlock": 1001000
   }
   ```

2. **Specific event type:**
   ```json
   {
     "address": "0x...",
     "eventSignature": "Transfer(address,address,uint256)",
     "fromBlock": 1000000,
     "toBlock": 1001000
   }
   ```

3. **Events with specific indexed parameter:**
   ```json
   {
     "address": "0x...",
     "topics": [
       "0x...", // Event signature hash
       "0x..."  // First indexed parameter
     ],
     "fromBlock": 1000000,
     "toBlock": 1001000
   }
   ```

#### Important Notes

- **Block Range Limit**: Maximum 10,000 blocks per query. Use pagination for larger ranges.
- **Topic Filtering**: Topics are AND-ed together. Use null for wildcards.
- **Decoding**: Requires valid event signature. Falls back to raw data if decoding fails.
- **Performance**: Smaller block ranges query faster. Consider batching large queries.

---

## Execution Tools

### 5. simulate_tx

Simulate transaction execution without sending it to the network.

#### Description

Executes an `eth_call` to simulate a transaction. Returns the result, gas usage (if available), and any revert information. Supports state overrides for testing hypothetical scenarios.

#### Input Schema

```typescript
{
  to: string                   // Target contract address
  data: string                 // Calldata (hex-encoded)
  from?: string                // Optional: Sender address
  gasLimit?: string            // Optional: Gas limit (hex or decimal)
  value?: string               // Optional: ETH value in wei (hex)
  abi?: any[]                  // Optional: Contract ABI for decoding
  functionName?: string        // Optional: Function name for decoding
  blockNumber?: BlockIdentifier // Optional: Block to simulate at
  stateOverrides?: Record<string, StateOverride>  // Optional: State overrides
  rpc?: string                 // Optional: RPC endpoint
}

interface StateOverride {
  balance?: string             // Override account balance (hex wei)
  nonce?: string               // Override nonce (hex or decimal)
  code?: string                // Override account code (hex)
  state?: Record<string, string>      // Override storage slots
  stateDiff?: Record<string, string>  // Storage diffs
}
```

**Field Details:**
- `to` (required): Contract address to call
  - Must match: `/^0x[a-fA-F0-9]{40}$/`

- `data` (required): Function calldata
  - Must match: `/^0x[a-fA-F0-9]*$/`
  - Use `encodeFunctionData` from viem/ethers to create

- `from` (optional): Caller address
  - Defaults to first unlocked Anvil account
  - Default: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

- `gasLimit` (optional): Maximum gas
  - Prevents infinite loops
  - Format: hex (`"0x100000"`) or decimal string (`"1000000"`)

- `value` (optional): ETH to send
  - Format: hex wei (`"0x0"`, `"0xde0b6b3a7640000"` = 1 ETH)

- `abi` (optional): Contract ABI
  - Used for automatic result decoding
  - Must include the function being called

- `functionName` (optional): Function name
  - Required if `abi` provided
  - Used to decode result

- `blockNumber` (optional): Block to simulate at
  - String: `"latest"`, `"earliest"`, `"pending"`, `"safe"`, `"finalized"`
  - String: Hex block number (`"0xf4240"`)
  - Default: `"latest"`

- `stateOverrides` (optional): Per-address state overrides
  - Key: Address (checksummed)
  - Value: StateOverride object
  - Used for hypothetical testing

- `rpc` (optional): RPC endpoint
  - Default: `"http://127.0.0.1:8545"`

#### Output Schema

```typescript
{
  result: string              // Return data (hex-encoded)
  decoded?: any               // Decoded return value (if ABI provided)
  gasUsed?: string            // Gas consumed (hex) - only with tracing
  logs?: LogEntry[]           // Event logs - only with tracing
  reverted: boolean           // Whether call reverted
  revertReason?: string       // Decoded revert reason
  revertData?: string         // Raw revert data (hex)
  error?: string              // Error message if simulation failed
}
```

#### Example Request - Basic

```json
{
  "tool": "simulate_tx",
  "arguments": {
    "to": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "data": "0x70a08231000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    "abi": [
      {
        "inputs": [{"name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    "functionName": "balanceOf"
  }
}
```

#### Example Request - With State Overrides

```json
{
  "tool": "simulate_tx",
  "arguments": {
    "to": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "data": "0xa9059cbb...",
    "from": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "stateOverrides": {
      "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045": {
        "balance": "0xde0b6b3a7640000",  // 1 ETH
        "state": {
          "0x0": "0x0000000000000000000000000000000000000000000000000000000000000001"
        }
      }
    }
  }
}
```

#### Example Response - Success

```json
{
  "result": "0x00000000000000000000000000000000000000000000000000000000000003e8",
  "decoded": "1000",
  "reverted": false
}
```

#### Example Response - Revert

```json
{
  "result": "0x",
  "reverted": true,
  "revertReason": "InsufficientBalance(1000, 500)",
  "revertData": "0x...",
  "error": "Execution reverted"
}
```

#### Common Use Cases

1. **Read contract state:**
   ```json
   {
     "to": "0x...",
     "data": "0x70a08231...",  // balanceOf(address)
     "abi": [...],
     "functionName": "balanceOf"
   }
   ```

2. **Test transaction before sending:**
   ```json
   {
     "to": "0x...",
     "data": "0xa9059cbb...",  // transfer(address,uint256)
     "from": "0x...",
     "abi": [...],
     "functionName": "transfer"
   }
   ```

3. **Simulate with overridden balance:**
   ```json
   {
     "to": "0x...",
     "data": "0x...",
     "stateOverrides": {
       "0x...": {
         "balance": "0xde0b6b3a7640000"  // Give account 1 ETH
       }
     }
   }
   ```

4. **Check revert conditions:**
   ```json
   {
     "to": "0x...",
     "data": "0x...",
     "gasLimit": "0x100000"  // Prevent infinite loop
   }
   ```

#### Important Notes

- **No State Changes**: Simulation does not modify blockchain state
- **Gas Limits**: Set reasonable `gasLimit` to prevent infinite loops
- **State Overrides**: Powerful for testing hypothetical scenarios
- **Decoding**: Requires correct ABI for automatic decoding

---

### 6. send_tx

Send actual transactions to the blockchain network.

#### Description

Creates, signs, and broadcasts a transaction. Waits for the specified number of confirmations and returns the transaction receipt. Supports both legacy and EIP-1559 fee markets.

#### Input Schema

```typescript
{
  to?: string                  // Optional: Target address (omit for deployment)
  data: string                 // Transaction data / bytecode
  from?: string                // Optional: Sender address
  value?: string               // Optional: ETH value in wei (hex)
  gasLimit?: string            // Optional: Gas limit (auto-estimated if omitted)
  gasPrice?: string            // Optional: Legacy gas price (wei)
  maxFeePerGas?: string        // Optional: EIP-1559 max fee per gas
  maxPriorityFeePerGas?: string // Optional: EIP-1559 priority fee
  nonce?: string               // Optional: Transaction nonce
  privateKey?: string          // Optional: Private key for signing
  confirmations?: number       // Optional: Confirmations to wait (default: 1)
  rpc?: string                 // Optional: RPC endpoint
}
```

**Field Details:**
- `to` (optional): Recipient address
  - Must match: `/^0x[a-fA-F0-9]{40}$/`
  - Omit for contract deployment

- `data` (required): Transaction data
  - Must match: `/^0x[a-fA-F0-9]*$/`
  - For calls: Function calldata
  - For deployments: Contract bytecode

- `from` (optional): Sender address
  - If omitted and no `privateKey`: Uses first Anvil account
  - If provided without `privateKey`: Requires Anvil (impersonation)

- `value` (optional): ETH to send
  - Format: hex wei
  - Default: `"0x0"`

- `gasLimit` (optional): Gas limit
  - Format: hex or decimal string
  - Auto-estimated if omitted

- `gasPrice` (optional): Legacy gas price
  - Format: hex or decimal string (wei)
  - Mutually exclusive with EIP-1559 fields

- `maxFeePerGas` (optional): EIP-1559 max fee
  - Format: hex or decimal string (wei)
  - Use with `maxPriorityFeePerGas`

- `maxPriorityFeePerGas` (optional): EIP-1559 priority fee
  - Format: hex or decimal string (wei)
  - Miner tip

- `nonce` (optional): Transaction nonce
  - Format: hex or decimal string
  - Auto-determined if omitted

- `privateKey` (optional): Signing key
  - Format: hex (0x-prefixed, 64 hex chars)
  - If omitted: Uses Anvil unlocked accounts

- `confirmations` (optional): Confirmations to wait
  - Number: 1-100
  - Default: 1

- `rpc` (optional): RPC endpoint
  - Default: `"http://127.0.0.1:8545"`

#### Output Schema

```typescript
{
  txHash: string               // Transaction hash
  blockNumber: string          // Block number (as string)
  blockHash: string            // Block hash
  gasUsed: string              // Actual gas consumed
  effectiveGasPrice: string    // Actual gas price paid
  status: "success" | "reverted"  // Transaction status
  logs: LogEntry[]             // Event logs emitted
  contractAddress?: string     // Deployed contract address (if deployment)
  revertReason?: string        // Decoded revert reason (if failed)
  revertData?: string          // Raw revert data (if failed)
  from: string                 // Sender address
  to?: string                  // Recipient address
}

interface LogEntry {
  address: string
  topics: string[]
  data: string
  logIndex: number
  transactionIndex: number
}
```

#### Example Request - Token Transfer

```json
{
  "tool": "send_tx",
  "arguments": {
    "to": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "data": "0xa9059cbb00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c800000000000000000000000000000000000000000000000000000000000003e8",
    "privateKey": "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    "value": "0x0"
  }
}
```

#### Example Request - Contract Deployment

```json
{
  "tool": "send_tx",
  "arguments": {
    "data": "0x608060405234801561001057600080fd5b50...",
    "privateKey": "0x...",
    "gasLimit": "0x500000"
  }
}
```

#### Example Request - EIP-1559

```json
{
  "tool": "send_tx",
  "arguments": {
    "to": "0x...",
    "data": "0x...",
    "maxFeePerGas": "0x3b9aca00",        // 1 gwei
    "maxPriorityFeePerGas": "0x59682f00", // 1.5 gwei
    "privateKey": "0x..."
  }
}
```

#### Example Response - Success

```json
{
  "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "blockNumber": "1000042",
  "blockHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "gasUsed": "52341",
  "effectiveGasPrice": "1000000000",
  "status": "success",
  "logs": [
    {
      "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "topics": ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"],
      "data": "0x00000000000000000000000000000000000000000000000000000000000003e8",
      "logIndex": 0,
      "transactionIndex": 5
    }
  ],
  "from": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "to": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

#### Example Response - Deployment

```json
{
  "txHash": "0x...",
  "blockNumber": "1000043",
  "blockHash": "0x...",
  "gasUsed": "1234567",
  "effectiveGasPrice": "1000000000",
  "status": "success",
  "logs": [],
  "contractAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "from": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
}
```

#### Common Use Cases

1. **Send token transfer:**
   ```json
   {
     "to": "0x...",
     "data": "0xa9059cbb...",  // transfer(address,uint256)
     "privateKey": "0x..."
   }
   ```

2. **Deploy contract:**
   ```json
   {
     "data": "0x608060405...",  // Contract bytecode
     "privateKey": "0x..."
   }
   ```

3. **Send with Anvil account (no private key):**
   ```json
   {
     "to": "0x...",
     "data": "0x...",
     "from": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
   }
   ```

4. **Wait for multiple confirmations:**
   ```json
   {
     "to": "0x...",
     "data": "0x...",
     "privateKey": "0x...",
     "confirmations": 3
   }
   ```

#### Important Notes

- **Private Keys**: NEVER log or expose private keys. Use environment variables.
- **Impersonation**: Without `privateKey`, requires Anvil for unlocked accounts
- **Gas Estimation**: Omit `gasLimit` for automatic estimation
- **Fee Market**: Use either `gasPrice` (legacy) OR `maxFeePerGas`+`maxPriorityFeePerGas` (EIP-1559)
- **Confirmations**: Higher confirmations = higher finality assurance

---

### 7. impersonate

Impersonate any address on Anvil for testing (Anvil only).

#### Description

Enables sending transactions from any address without knowing the private key. Only works on Anvil instances. Useful for testing multi-user scenarios and access control.

#### Input Schema

```typescript
{
  address: string              // Address to impersonate
  stopImpersonating?: boolean  // Optional: Stop impersonation (default: false)
  rpc?: string                 // Optional: RPC endpoint (must be Anvil)
}
```

**Field Details:**
- `address` (required): Address to impersonate
  - Must match: `/^0x[a-fA-F0-9]{40}$/`

- `stopImpersonating` (optional): Stop impersonation
  - Boolean
  - Default: `false`

- `rpc` (optional): RPC endpoint
  - Must be an Anvil instance
  - Default: `"http://127.0.0.1:8545"`

#### Output Schema

```typescript
{
  success: boolean    // Whether operation succeeded
  address: string     // Address being impersonated
  active: boolean     // Whether impersonation is currently active
  balance?: string    // Current balance of impersonated address (hex wei)
}
```

#### Example Request - Start Impersonation

```json
{
  "tool": "impersonate",
  "arguments": {
    "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
  }
}
```

#### Example Request - Stop Impersonation

```json
{
  "tool": "impersonate",
  "arguments": {
    "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "stopImpersonating": true
  }
}
```

#### Example Response - Started

```json
{
  "success": true,
  "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "active": true,
  "balance": "0x0"
}
```

#### Example Response - Stopped

```json
{
  "success": true,
  "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "active": false
}
```

#### Common Use Cases

1. **Test as contract owner:**
   ```json
   {
     "address": "0x..."  // Owner address
   }
   // Now send_tx without privateKey will use this address
   ```

2. **Multi-user testing:**
   ```json
   // Impersonate user 1
   {"address": "0x...user1"}
   // Send tx as user1

   // Stop impersonating user1
   {"address": "0x...user1", "stopImpersonating": true}

   // Impersonate user 2
   {"address": "0x...user2"}
   // Send tx as user2
   ```

3. **Test access control:**
   ```json
   // Impersonate unauthorized user
   {"address": "0x...unauthorized"}
   // Try to call privileged function (should revert)
   ```

#### Important Notes

- **Anvil Only**: Will fail on testnets, mainnet, or any non-Anvil RPC
- **Zero Balance Warning**: Tool warns if impersonated address has zero balance
- **No Private Key**: Impersonation works without knowing the private key
- **State Persists**: Impersonation remains active until explicitly stopped
- **Testing Only**: NEVER use in production environments

---

### 8. create_snapshot

Create Anvil state snapshot for later revert.

#### Description

Captures the current blockchain state (balances, storage, nonce) into a snapshot that can be reverted to later. Useful for testing multiple scenarios from the same starting state.

#### Input Schema

```typescript
{
  name?: string         // Optional: Human-readable snapshot name
  description?: string  // Optional: Snapshot description
  rpc?: string          // Optional: RPC endpoint (must be Anvil)
}
```

**Field Details:**
- `name` (optional): Snapshot identifier
  - Must be unique
  - Can be used instead of `snapshotId` for revert
  - Example: `"before-attack-simulation"`

- `description` (optional): Snapshot description
  - Human-readable context
  - Example: `"State before testing exploit scenario"`

- `rpc` (optional): RPC endpoint
  - Must be Anvil instance
  - Default: `"http://127.0.0.1:8545"`

#### Output Schema

```typescript
{
  snapshotId: string    // Unique snapshot identifier
  name?: string         // Human-readable name (if provided)
  blockNumber: number   // Block number at snapshot
  blockHash: string     // Block hash at snapshot
  timestamp: number     // Block timestamp
  created: number       // Unix timestamp when snapshot was created
}
```

#### Example Request

```json
{
  "tool": "create_snapshot",
  "arguments": {
    "name": "clean-state",
    "description": "Initial state with 1000 tokens minted"
  }
}
```

#### Example Response

```json
{
  "snapshotId": "0x1",
  "name": "clean-state",
  "blockNumber": 42,
  "blockHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "timestamp": 1701234567,
  "created": 1701234567890
}
```

#### Common Use Cases

1. **Test multiple scenarios:**
   ```json
   // Create snapshot
   {"name": "initial"}

   // Run scenario A
   // ... send transactions ...

   // Revert to initial state
   {"snapshotId": "initial"}

   // Run scenario B
   // ... send different transactions ...
   ```

2. **Before/after comparisons:**
   ```json
   // Snapshot before
   {"name": "before-upgrade"}

   // Perform upgrade
   // ... upgrade contract ...

   // Snapshot after
   {"name": "after-upgrade"}

   // Can revert to either state
   ```

3. **Iterative testing:**
   ```json
   // Snapshot clean state
   {"name": "clean"}

   for (test in tests) {
     // Run test
     // ... execute test ...

     // Revert to clean state
     {"snapshotId": "clean"}
   }
   ```

#### Important Notes

- **Unique Names**: Snapshot names must be unique per session
- **Lost on Restart**: Snapshots are lost when Anvil restarts
- **Persistent Backup**: Use `anvil_dumpState` for persistent backups
- **Single Use**: Most providers invalidate snapshot IDs after revert
- **Anvil Only**: Only works on Anvil instances

---

### 9. revert_snapshot

Revert blockchain state to a previous snapshot.

#### Description

Restores the blockchain to the state captured in a previous snapshot. Undoes all transactions, balance changes, and storage modifications since the snapshot was created.

#### Input Schema

```typescript
{
  snapshotId: string  // Snapshot ID or name to revert to
  rpc?: string        // Optional: RPC endpoint (must be Anvil)
}
```

**Field Details:**
- `snapshotId` (required): Snapshot identifier
  - Can be snapshot ID (e.g., `"0x1"`)
  - Can be snapshot name (e.g., `"clean-state"`)
  - Must have been created with `create_snapshot`

- `rpc` (optional): RPC endpoint
  - Must be Anvil instance
  - Default: `"http://127.0.0.1:8545"`

#### Output Schema

```typescript
{
  success: boolean     // Whether revert succeeded
  snapshotId: string   // ID that was reverted to
  blockNumber: number  // Block number after revert
  blockHash: string    // Block hash after revert
  timestamp: number    // Block timestamp after revert
  reverted: boolean    // Confirmation of state revert
}
```

#### Example Request - By Name

```json
{
  "tool": "revert_snapshot",
  "arguments": {
    "snapshotId": "clean-state"
  }
}
```

#### Example Request - By ID

```json
{
  "tool": "revert_snapshot",
  "arguments": {
    "snapshotId": "0x1"
  }
}
```

#### Example Response

```json
{
  "success": true,
  "snapshotId": "0x1",
  "blockNumber": 42,
  "blockHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "timestamp": 1701234567,
  "reverted": true
}
```

#### Common Use Cases

1. **Reset test state:**
   ```json
   // After running tests
   {"snapshotId": "initial"}
   ```

2. **Undo failed transaction:**
   ```json
   // Create snapshot
   {"name": "before-tx"}

   // Send transaction (fails)
   // ...

   // Revert to before transaction
   {"snapshotId": "before-tx"}
   ```

3. **Compare outcomes:**
   ```json
   // Snapshot state A
   {"name": "state-a"}

   // Modify state
   // ...

   // Snapshot state B
   {"name": "state-b"}

   // Revert to A
   {"snapshotId": "state-a"}

   // Compare with B
   // ...
   ```

#### Important Notes

- **Single Use**: Snapshot IDs are typically invalidated after revert
- **Create New Snapshot**: After revert, create a new snapshot if needed
- **Not Found Error**: Fails if snapshot ID/name doesn't exist
- **Already Consumed**: Warning if snapshot was already reverted
- **Anvil Only**: Only works on Anvil instances

---

## Error Handling

All tools follow a consistent error format:

```typescript
{
  tool: string        // Tool name
  code: string        // Error code
  message: string     // Human-readable message
  context?: object    // Additional error context
}
```

### Common Error Codes

- `PATH_TRAVERSAL` - Attempted path traversal attack
- `FILE_NOT_FOUND` - File does not exist
- `READ_ERROR` - Failed to read file/data
- `RPC_ERROR` - RPC connection or query failed
- `UNSUPPORTED_BLOCK_TAG` - Block tag not supported
- `BLOCK_RANGE_TOO_LARGE` - Query range exceeds limit

### Error Handling Best Practices

1. **Always check error codes** - Use structured error codes, not messages
2. **Implement retries** - For transient RPC_ERROR failures
3. **Validate inputs** - Use Zod schemas for type safety
4. **Log errors** - Preserve error context for debugging

---

## Best Practices

### General

1. **Simulate before sending** - Always use `simulate_tx` before `send_tx`
2. **Use snapshots for testing** - Create/revert for reproducible tests
3. **Validate addresses** - Use checksummed addresses
4. **Set gas limits** - Prevent infinite loops in simulations
5. **Decode with ABIs** - Provide ABIs for automatic decoding

### Reading Tools

1. **Limit block ranges** - Query small ranges for `read_events`
2. **Use pagination** - Split large queries into batches
3. **Cache results** - Store frequently accessed data
4. **Verify bytecode** - Check `isEmpty` before assuming contract exists

### Execution Tools

1. **Never expose private keys** - Use environment variables
2. **Impersonate carefully** - Only use on Anvil
3. **Name snapshots** - Use descriptive names for clarity
4. **Wait for confirmations** - Higher confirmations = higher finality
5. **Handle reverts** - Check `status` and `revertReason`

---

## Examples

### Complete Audit Workflow

```typescript
// 1. Read contract source
read_source({
  path: "PoolManager.sol"
})

// 2. Get deployed bytecode
read_bytecode({
  address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
})

// 3. Read storage slots
read_storage({
  address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  slot: "0x0"  // Owner
})

// 4. Query recent events
read_events({
  address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  eventSignature: "Transfer(address,address,uint256)",
  fromBlock: 1000000,
  toBlock: "latest"
})

// 5. Create snapshot for testing
create_snapshot({
  name: "before-exploit"
})

// 6. Simulate exploit
simulate_tx({
  to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  data: "0x...",  // Exploit calldata
  abi: [...],
  functionName: "exploitFunction"
})

// 7. If simulation succeeds, try actual exploit
send_tx({
  to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  data: "0x...",
  privateKey: "0x..."
})

// 8. Revert state
revert_snapshot({
  snapshotId: "before-exploit"
})
```

### Testing Access Control

```typescript
// 1. Create clean state
create_snapshot({
  name: "clean"
})

// 2. Impersonate unauthorized user
impersonate({
  address: "0x...unauthorized"
})

// 3. Try privileged function (should fail)
simulate_tx({
  to: "0x...",
  data: "0x...",  // privileged function
  from: "0x...unauthorized"
})
// Expect: reverted = true

// 4. Stop impersonating
impersonate({
  address: "0x...unauthorized",
  stopImpersonating: true
})

// 5. Impersonate owner
impersonate({
  address: "0x...owner"
})

// 6. Try privileged function (should succeed)
simulate_tx({
  to: "0x...",
  data: "0x...",
  from: "0x...owner"
})
// Expect: reverted = false

// 7. Clean up
revert_snapshot({
  snapshotId: "clean"
})
```

---

## Tool Matrix

| Tool | Modifies State | Requires Anvil | Requires ABI | Returns Decoded |
|------|----------------|----------------|--------------|-----------------|
| read_source | No | No | No | N/A |
| read_storage | No | No | No | Yes (optional) |
| read_bytecode | No | No | No | No |
| read_events | No | No | Yes (optional) | Yes (optional) |
| simulate_tx | No | No | Yes (optional) | Yes (optional) |
| send_tx | Yes | No* | No | No |
| impersonate | No | Yes | No | No |
| create_snapshot | No | Yes | No | No |
| revert_snapshot | Yes | Yes | No | No |

*`send_tx` without `privateKey` requires Anvil

---

## Additional Resources

- [MCP Protocol Specification](https://modelcontextprotocol.io/specification)
- [viem Documentation](https://viem.sh/)
- [Foundry Anvil Guide](https://book.getfoundry.sh/anvil/)
- [Ethereum JSON-RPC API](https://ethereum.org/en/developers/docs/apis/json-rpc/)
- [Solidity Storage Layout](https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html)
