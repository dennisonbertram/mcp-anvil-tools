#!/bin/bash
# Manual test script for stdio transport
# Usage: ./test-stdio-manual.sh

echo "Testing MCP Server stdio transport..."
echo ""
echo "Sending initialize request..."

echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | npm run start:stdio

echo ""
echo "Test complete!"
