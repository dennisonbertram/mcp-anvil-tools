#!/bin/bash

# Test script for trace_transaction and trace_call MCP tools
# Uses curl to interact with the MCP server

set -e

MCP_SERVER_URL="http://localhost:3000"
CONTRACT_ADDRESS="0x5fbdb2315678afecb367f032d93f642f64180aa3"
DEPLOYMENT_TX_HASH="0x3f87a36555b1c0c6d1fb9a162c42e43323c2809e3fd25bbcc25df1c2bad50ae8"
VALUE_FUNCTION_SELECTOR="0x3fa4f245"

echo "🚀 MCP Tracing Tools Test Suite"
echo "================================================================================"
echo "Contract Address: $CONTRACT_ADDRESS"
echo "Deployment TX Hash: $DEPLOYMENT_TX_HASH"
echo "Test Function: value() [selector: $VALUE_FUNCTION_SELECTOR]"
echo "================================================================================"

# Create a temporary file for SSE connection
SSE_LOG=$(mktemp)

echo ""
echo "🔌 Connecting to MCP server SSE endpoint..."

# Start SSE connection in background and log output
curl -sN "$MCP_SERVER_URL/sse" > "$SSE_LOG" 2>&1 &
SSE_PID=$!

# Give it a moment to connect
sleep 1

# Extract session ID from SSE log
SESSION_ID=$(grep -A1 "event: endpoint" "$SSE_LOG" | grep "data:" | sed 's/.*sessionId=\([^&"]*\).*/\1/' | head -1)

if [ -z "$SESSION_ID" ]; then
    echo "❌ Failed to get session ID from SSE"
    echo "SSE Log contents:"
    cat "$SSE_LOG"
    kill $SSE_PID 2>/dev/null || true
    rm -f "$SSE_LOG"
    exit 1
fi

echo "✅ Got session ID: $SESSION_ID"
echo "✅ SSE connection established (PID: $SSE_PID)"

# Function to call MCP tool
call_tool() {
    local tool_name=$1
    local args=$2
    local id=$3

    curl -s -X POST "$MCP_SERVER_URL/messages?sessionId=$SESSION_ID" \
        -H "Content-Type: application/json" \
        -d "{
            \"jsonrpc\": \"2.0\",
            \"id\": $id,
            \"method\": \"tools/call\",
            \"params\": {
                \"name\": \"$tool_name\",
                \"arguments\": $args
            }
        }"
}

# Initialize MCP session
echo "🔧 Initializing MCP session..."
INIT_RESPONSE=$(curl -s -X POST "$MCP_SERVER_URL/messages?sessionId=$SESSION_ID" \
    -H "Content-Type: application/json" \
    -d '{
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "trace-test",
                "version": "1.0.0"
            }
        }
    }')

if echo "$INIT_RESPONSE" | grep -q '"error"'; then
    echo "❌ Failed to initialize MCP session"
    echo "$INIT_RESPONSE" | jq . 2>/dev/null || echo "$INIT_RESPONSE"
    kill $SSE_PID 2>/dev/null || true
    rm -f "$SSE_LOG"
    exit 1
fi

echo "✅ MCP session initialized"

REQUEST_ID=2

echo ""
echo "================================================================================"
echo "📍 TESTING trace_transaction"
echo "================================================================================"

# Test 1: callTracer
echo ""
echo "📊 Testing: callTracer"
echo "--------------------------------------------------------------------------------"
RESULT=$(call_tool "trace_transaction" "{
    \"txHash\": \"$DEPLOYMENT_TX_HASH\",
    \"rpcUrl\": \"http://localhost:8545\",
    \"tracerConfig\": {
        \"tracer\": \"callTracer\"
    }
}" $REQUEST_ID)

if echo "$RESULT" | grep -q '"error"'; then
    echo "❌ Error:"
    echo "$RESULT" | jq . 2>/dev/null || echo "$RESULT"
else
    echo "✅ Success!"
    echo "📄 Result preview:"
    echo "$RESULT" | jq . 2>/dev/null | head -50 || echo "$RESULT"
fi

REQUEST_ID=$((REQUEST_ID + 1))
sleep 0.5

# Test 2: prestateTracer
echo ""
echo "📊 Testing: prestateTracer"
echo "--------------------------------------------------------------------------------"
RESULT=$(call_tool "trace_transaction" "{
    \"txHash\": \"$DEPLOYMENT_TX_HASH\",
    \"rpcUrl\": \"http://localhost:8545\",
    \"tracerConfig\": {
        \"tracer\": \"prestateTracer\"
    }
}" $REQUEST_ID)

if echo "$RESULT" | grep -q '"error"'; then
    echo "❌ Error:"
    echo "$RESULT" | jq . 2>/dev/null || echo "$RESULT"
else
    echo "✅ Success!"
    echo "📄 Result preview:"
    echo "$RESULT" | jq . 2>/dev/null | head -50 || echo "$RESULT"
fi

REQUEST_ID=$((REQUEST_ID + 1))
sleep 0.5

# Test 3: 4byteTracer
echo ""
echo "📊 Testing: 4byteTracer"
echo "--------------------------------------------------------------------------------"
RESULT=$(call_tool "trace_transaction" "{
    \"txHash\": \"$DEPLOYMENT_TX_HASH\",
    \"rpcUrl\": \"http://localhost:8545\",
    \"tracerConfig\": {
        \"tracer\": \"4byteTracer\"
    }
}" $REQUEST_ID)

if echo "$RESULT" | grep -q '"error"'; then
    echo "❌ Error:"
    echo "$RESULT" | jq . 2>/dev/null || echo "$RESULT"
else
    echo "✅ Success!"
    echo "📄 Result:"
    echo "$RESULT" | jq . 2>/dev/null || echo "$RESULT"
fi

REQUEST_ID=$((REQUEST_ID + 1))
sleep 0.5

# Test 4: No tracer (raw opcodes)
echo ""
echo "📊 Testing: No tracer (raw opcodes)"
echo "--------------------------------------------------------------------------------"
RESULT=$(call_tool "trace_transaction" "{
    \"txHash\": \"$DEPLOYMENT_TX_HASH\",
    \"rpcUrl\": \"http://localhost:8545\"
}" $REQUEST_ID)

if echo "$RESULT" | grep -q '"error"'; then
    echo "❌ Error:"
    echo "$RESULT" | jq . 2>/dev/null || echo "$RESULT"
else
    echo "✅ Success!"
    echo "📄 Result preview (first 100 lines):"
    echo "$RESULT" | jq . 2>/dev/null | head -100 || echo "$RESULT"
fi

REQUEST_ID=$((REQUEST_ID + 1))
sleep 0.5

echo ""
echo "================================================================================"
echo "📍 TESTING trace_call"
echo "================================================================================"

# Test 5: trace_call with callTracer
echo ""
echo "📊 Testing: callTracer for value() function call"
echo "--------------------------------------------------------------------------------"
RESULT=$(call_tool "trace_call" "{
    \"to\": \"$CONTRACT_ADDRESS\",
    \"data\": \"$VALUE_FUNCTION_SELECTOR\",
    \"rpcUrl\": \"http://localhost:8545\",
    \"tracerConfig\": {
        \"tracer\": \"callTracer\"
    }
}" $REQUEST_ID)

if echo "$RESULT" | grep -q '"error"'; then
    echo "❌ Error:"
    echo "$RESULT" | jq . 2>/dev/null || echo "$RESULT"
else
    echo "✅ Success!"
    echo "📄 Result:"
    echo "$RESULT" | jq . 2>/dev/null || echo "$RESULT"
fi

REQUEST_ID=$((REQUEST_ID + 1))
sleep 0.5

# Test 6: trace_call with prestateTracer
echo ""
echo "📊 Testing: prestateTracer for value() function call"
echo "--------------------------------------------------------------------------------"
RESULT=$(call_tool "trace_call" "{
    \"to\": \"$CONTRACT_ADDRESS\",
    \"data\": \"$VALUE_FUNCTION_SELECTOR\",
    \"rpcUrl\": \"http://localhost:8545\",
    \"tracerConfig\": {
        \"tracer\": \"prestateTracer\"
    }
}" $REQUEST_ID)

if echo "$RESULT" | grep -q '"error"'; then
    echo "❌ Error:"
    echo "$RESULT" | jq . 2>/dev/null || echo "$RESULT"
else
    echo "✅ Success!"
    echo "📄 Result:"
    echo "$RESULT" | jq . 2>/dev/null || echo "$RESULT"
fi

REQUEST_ID=$((REQUEST_ID + 1))
sleep 0.5

# Test 7: trace_call with no tracer
echo ""
echo "📊 Testing: Raw opcode trace for value() function call"
echo "--------------------------------------------------------------------------------"
RESULT=$(call_tool "trace_call" "{
    \"to\": \"$CONTRACT_ADDRESS\",
    \"data\": \"$VALUE_FUNCTION_SELECTOR\",
    \"rpcUrl\": \"http://localhost:8545\"
}" $REQUEST_ID)

if echo "$RESULT" | grep -q '"error"'; then
    echo "❌ Error:"
    echo "$RESULT" | jq . 2>/dev/null || echo "$RESULT"
else
    echo "✅ Success!"
    echo "📄 Result preview (first 100 lines):"
    echo "$RESULT" | jq . 2>/dev/null | head -100 || echo "$RESULT"
fi

echo ""
echo "================================================================================"
echo "✅ Test suite completed!"
echo "================================================================================"

# Cleanup
kill $SSE_PID 2>/dev/null || true
rm -f "$SSE_LOG"
