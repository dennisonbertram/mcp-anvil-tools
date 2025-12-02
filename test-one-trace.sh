#!/bin/bash

# Test a single trace_transaction call
MCP_SERVER_URL="http://localhost:3000"
DEPLOYMENT_TX_HASH="0x3f87a36555b1c0c6d1fb9a162c42e43323c2809e3fd25bbcc25df1c2bad50ae8"

# Start SSE and get session ID
SSE_LOG=$(mktemp)
curl -sN "$MCP_SERVER_URL/sse" > "$SSE_LOG" 2>&1 &
SSE_PID=$!
sleep 1

SESSION_ID=$(grep -A1 "event: endpoint" "$SSE_LOG" | grep "data:" | sed 's/.*sessionId=\([^&"]*\).*/\1/' | head -1)

echo "Session ID: $SESSION_ID"

# Initialize
curl -s -X POST "$MCP_SERVER_URL/messages?sessionId=$SESSION_ID" \
    -H "Content-Type: application/json" \
    -d '{
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "test", "version": "1.0.0"}
        }
    }' > /dev/null

# Call trace_transaction with callTracer
echo "Calling trace_transaction with callTracer..."
RESULT=$(curl -s -X POST "$MCP_SERVER_URL/messages?sessionId=$SESSION_ID" \
    -H "Content-Type: application/json" \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": 2,
        \"method\": \"tools/call\",
        \"params\": {
            \"name\": \"trace_transaction\",
            \"arguments\": {
                \"txHash\": \"$DEPLOYMENT_TX_HASH\",
                \"rpcUrl\": \"http://localhost:8545\",
                \"tracerConfig\": {
                    \"tracer\": \"callTracer\"
                }
            }
        }
    }")

echo "Raw result:"
echo "$RESULT"

echo ""
echo "Formatted result:"
echo "$RESULT" | jq .

# Cleanup
kill $SSE_PID 2>/dev/null || true
rm -f "$SSE_LOG"
