# stdio Transport Implementation Summary

## Overview

Successfully added stdio transport support to the MCP server, enabling CLI usage and integration with Claude Desktop and other MCP clients.

## Changes Made

### 1. Updated `src/index.ts`

- Added `--stdio` command-line flag detection
- Imported `StdioServerTransport` from MCP SDK
- Imported new `createStdioMcpServer` function
- Added conditional logic to start server in either HTTP/SSE or stdio mode
- stdio mode uses `console.error` for logs (keeps stdout clean for JSON-RPC)
- Graceful shutdown handling for both modes

### 2. Updated `src/server.ts`

- Added `StdioMcpServerContext` interface (without Express app)
- Created `createStdioMcpServer()` function for stdio-only initialization
- Simplified server setup without HTTP endpoints in stdio mode

### 3. Updated `src/tools/index.ts`

- Added import for `ListToolsRequestSchema` from MCP SDK
- Registered explicit handler for `tools/list` requests
- Required for low-level Server class (high-level McpServer does this automatically)
- Returns empty tools array (will be populated in Phase 2)

### 4. Updated `package.json`

- Added `start:stdio` script: `node dist/index.js --stdio`

### 5. Created Test Files

- `test-stdio.ts`: Automated test suite using TypeScript
  - Tests initialize handshake
  - Tests tools/list request
  - Verifies JSON-RPC responses
  - Full end-to-end validation

- `test-stdio-manual.sh`: Simple shell script for manual testing
  - Quick verification with echo command

### 6. Updated `README.md`

- Added stdio Mode section with usage examples
- Documented both transport modes (HTTP/SSE and stdio)
- Added test script documentation
- Updated MCP Connection section

## Test Results

All tests passing:

```
 ALL TESTS PASSED!
Initialize: PASS
Tools/list: PASS
```

## Usage

### Start in stdio mode:

```bash
npm run start:stdio
```

### Start in HTTP/SSE mode (default):

```bash
npm start
```

### Test stdio transport:

```bash
# Automated test
npx tsx test-stdio.ts

# Manual test
./test-stdio-manual.sh

# Echo test
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | npm run start:stdio
```

## Technical Details

### stdio Transport

- Uses `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`
- Reads JSON-RPC requests from stdin (one per line)
- Writes JSON-RPC responses to stdout (one per line)
- Logs to stderr to keep stdout clean

### MCP Protocol Support

The server now properly handles:
- `initialize` request - Server handshake
- `initialized` notification - Initialization complete
- `tools/list` request - List available tools (returns empty array for now)

### Future Tool Registration

When tools are added in Phase 2+, update the `tools/list` handler in `src/tools/index.ts` to return the actual tool definitions instead of an empty array.

## Claude Desktop Integration

To use with Claude Desktop, add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "mcp-anvil-tools": {
      "command": "node",
      "args": [
        "/path/to/mcp-anvil-tools/dist/index.js",
        "--stdio"
      ],
      "env": {
        "AUDIT_API_KEY": "your-api-key",
        "MAINNET_RPC_URL": "your-rpc-url"
      }
    }
  }
}
```

## Files Modified

- `src/index.ts`
- `src/server.ts`
- `src/tools/index.ts`
- `package.json`
- `README.md`

## Files Created

- `test-stdio.ts`
- `test-stdio-manual.sh`
- `STDIO-IMPLEMENTATION.md`
