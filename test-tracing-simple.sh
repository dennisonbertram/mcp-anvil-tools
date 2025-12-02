#!/bin/bash

# Simple test script using MCP inspect tool instead of custom HTTP client
# This is much easier than managing SSE connections

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
echo ""
echo "Note: Testing tools directly via Anvil RPC (not through MCP transport)"
echo "================================================================================"

# Test trace_transaction directly against Anvil
echo ""
echo "================================================================================"
echo "📍 TESTING trace_transaction (direct Anvil RPC calls)"
echo "================================================================================"

echo ""
echo "📊 Testing: callTracer"
echo "--------------------------------------------------------------------------------"
RESULT=$(curl -s -X POST http://localhost:8545 \
    -H "Content-Type: application/json" \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": 1,
        \"method\": \"debug_traceTransaction\",
        \"params\": [
            \"$DEPLOYMENT_TX_HASH\",
            {\"tracer\": \"callTracer\"}
        ]
    }")

if echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
    echo "❌ Error:"
    echo "$RESULT" | jq .
else
    echo "✅ Success!"
    echo "📄 Result:"
    echo "$RESULT" | jq .result | head -50
fi

echo ""
echo "📊 Testing: prestateTracer"
echo "--------------------------------------------------------------------------------"
RESULT=$(curl -s -X POST http://localhost:8545 \
    -H "Content-Type: application/json" \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": 2,
        \"method\": \"debug_traceTransaction\",
        \"params\": [
            \"$DEPLOYMENT_TX_HASH\",
            {\"tracer\": \"prestateTracer\"}
        ]
    }")

if echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
    echo "❌ Error:"
    echo "$RESULT" | jq .
else
    echo "✅ Success!"
    echo "📄 Result:"
    echo "$RESULT" | jq .result | head -50
fi

echo ""
echo "📊 Testing: 4byteTracer"
echo "--------------------------------------------------------------------------------"
RESULT=$(curl -s -X POST http://localhost:8545 \
    -H "Content-Type: application/json" \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": 3,
        \"method\": \"debug_traceTransaction\",
        \"params\": [
            \"$DEPLOYMENT_TX_HASH\",
            {\"tracer\": \"4byteTracer\"}
        ]
    }")

if echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
    echo "❌ Error:"
    echo "$RESULT" | jq .
else
    echo "✅ Success!"
    echo "📄 Result:"
    echo "$RESULT" | jq .result
fi

echo ""
echo "📊 Testing: No tracer (raw opcodes)"
echo "--------------------------------------------------------------------------------"
RESULT=$(curl -s -X POST http://localhost:8545 \
    -H "Content-Type: application/json" \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": 4,
        \"method\": \"debug_traceTransaction\",
        \"params\": [
            \"$DEPLOYMENT_TX_HASH\"
        ]
    }")

if echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
    echo "❌ Error:"
    echo "$RESULT" | jq .
else
    echo "✅ Success!"
    echo "📄 Result preview (showing structure logs count):"
    echo "$RESULT" | jq '.result.structLogs | length'
    echo "First 5 struct logs:"
    echo "$RESULT" | jq '.result.structLogs[:5]'
fi

echo ""
echo "================================================================================"
echo "📍 TESTING trace_call (debug_traceCall)"
echo "================================================================================"

echo ""
echo "📊 Testing: callTracer for value() function call"
echo "--------------------------------------------------------------------------------"
RESULT=$(curl -s -X POST http://localhost:8545 \
    -H "Content-Type: application/json" \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": 5,
        \"method\": \"debug_traceCall\",
        \"params\": [
            {
                \"to\": \"$CONTRACT_ADDRESS\",
                \"data\": \"$VALUE_FUNCTION_SELECTOR\"
            },
            \"latest\",
            {\"tracer\": \"callTracer\"}
        ]
    }")

if echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
    echo "❌ Error:"
    echo "$RESULT" | jq .
else
    echo "✅ Success!"
    echo "📄 Result:"
    echo "$RESULT" | jq .result
fi

echo ""
echo "📊 Testing: prestateTracer for value() function call"
echo "--------------------------------------------------------------------------------"
RESULT=$(curl -s -X POST http://localhost:8545 \
    -H "Content-Type: application/json" \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": 6,
        \"method\": \"debug_traceCall\",
        \"params\": [
            {
                \"to\": \"$CONTRACT_ADDRESS\",
                \"data\": \"$VALUE_FUNCTION_SELECTOR\"
            },
            \"latest\",
            {\"tracer\": \"prestateTracer\"}
        ]
    }")

if echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
    echo "❌ Error:"
    echo "$RESULT" | jq .
else
    echo "✅ Success!"
    echo "📄 Result:"
    echo "$RESULT" | jq .result
fi

echo ""
echo "📊 Testing: Raw opcode trace for value() function call"
echo "--------------------------------------------------------------------------------"
RESULT=$(curl -s -X POST http://localhost:8545 \
    -H "Content-Type: application/json" \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": 7,
        \"method\": \"debug_traceCall\",
        \"params\": [
            {
                \"to\": \"$CONTRACT_ADDRESS\",
                \"data\": \"$VALUE_FUNCTION_SELECTOR\"
            },
            \"latest\"
        ]
    }")

if echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
    echo "❌ Error:"
    echo "$RESULT" | jq .
else
    echo "✅ Success!"
    echo "📄 Result preview (showing structure logs count):"
    echo "$RESULT" | jq '.result.structLogs | length'
    echo "First 5 struct logs:"
    echo "$RESULT" | jq '.result.structLogs[:5]'
fi

echo ""
echo "================================================================================"
echo "✅ Test suite completed!"
echo "================================================================================"
