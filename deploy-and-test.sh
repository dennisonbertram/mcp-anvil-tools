#!/bin/bash

# Deploy a simple contract and test tracing

set -e

echo "🚀 Deploy Contract and Test Tracing"
echo "================================================================================"

# Simple contract bytecode that stores 42 in slot 0
# Constructor: PUSH1 0x2a (42), PUSH1 0x00 (slot 0), SSTORE, RETURN
# Runtime: PUSH1 0x2a (42), PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
BYTECODE="0x602a6000556020806100126000396000f3fe602a60005260206000f3"

echo "📦 Deploying contract with bytecode: $BYTECODE"

# Get default account
DEFAULT_ACCOUNT=$(curl -s -X POST http://localhost:8545 -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"eth_accounts","params":[]}' | jq -r '.result[0]')

echo "Using account: $DEFAULT_ACCOUNT"

# Deploy contract
DEPLOY_TX=$(curl -s -X POST http://localhost:8545 -H "Content-Type: application/json" \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": 2,
        \"method\": \"eth_sendTransaction\",
        \"params\": [{
            \"from\": \"$DEFAULT_ACCOUNT\",
            \"data\": \"$BYTECODE\"
        }]
    }" | jq -r '.result')

echo "✅ Deployment TX: $DEPLOY_TX"

# Wait for transaction to be mined
sleep 1

# Get transaction receipt to find contract address
RECEIPT=$(curl -s -X POST http://localhost:8545 -H "Content-Type: application/json" \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": 3,
        \"method\": \"eth_getTransactionReceipt\",
        \"params\": [\"$DEPLOY_TX\"]
    }")

CONTRACT_ADDRESS=$(echo "$RECEIPT" | jq -r '.result.contractAddress')

echo "✅ Contract deployed at: $CONTRACT_ADDRESS"
echo ""

# Now test tracing
echo "================================================================================"
echo "📍 TESTING trace_transaction"
echo "================================================================================"

echo ""
echo "📊 Testing: callTracer"
echo "--------------------------------------------------------------------------------"
RESULT=$(curl -s -X POST http://localhost:8545 \
    -H "Content-Type: application/json" \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": 10,
        \"method\": \"debug_traceTransaction\",
        \"params\": [
            \"$DEPLOY_TX\",
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
echo "📊 Testing: prestateTracer"
echo "--------------------------------------------------------------------------------"
RESULT=$(curl -s -X POST http://localhost:8545 \
    -H "Content-Type: application/json" \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": 11,
        \"method\": \"debug_traceTransaction\",
        \"params\": [
            \"$DEPLOY_TX\",
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
echo "📊 Testing: 4byteTracer"
echo "--------------------------------------------------------------------------------"
RESULT=$(curl -s -X POST http://localhost:8545 \
    -H "Content-Type: application/json" \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": 12,
        \"method\": \"debug_traceTransaction\",
        \"params\": [
            \"$DEPLOY_TX\",
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
        \"id\": 13,
        \"method\": \"debug_traceTransaction\",
        \"params\": [
            \"$DEPLOY_TX\"
        ]
    }")

if echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
    echo "❌ Error:"
    echo "$RESULT" | jq .
else
    echo "✅ Success!"
    echo "📄 Result has ${RESULT} characters"
    echo "Struct logs count:"
    echo "$RESULT" | jq '.result.structLogs | length'
    echo "First 3 struct logs:"
    echo "$RESULT" | jq '.result.structLogs[:3]'
fi

echo ""
echo "================================================================================"
echo "📍 TESTING trace_call"
echo "================================================================================"

# Function selector for a simple function that returns 42
# Since our contract just returns 42, we can call it with any data
CALL_DATA="0x"

echo ""
echo "📊 Testing: callTracer for contract call"
echo "--------------------------------------------------------------------------------"
RESULT=$(curl -s -X POST http://localhost:8545 \
    -H "Content-Type: application/json" \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": 20,
        \"method\": \"debug_traceCall\",
        \"params\": [
            {
                \"to\": \"$CONTRACT_ADDRESS\",
                \"data\": \"$CALL_DATA\"
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
echo "📊 Testing: prestateTracer for contract call"
echo "--------------------------------------------------------------------------------"
RESULT=$(curl -s -X POST http://localhost:8545 \
    -H "Content-Type: application/json" \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": 21,
        \"method\": \"debug_traceCall\",
        \"params\": [
            {
                \"to\": \"$CONTRACT_ADDRESS\",
                \"data\": \"$CALL_DATA\"
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
echo "📊 Testing: Raw opcode trace for contract call"
echo "--------------------------------------------------------------------------------"
RESULT=$(curl -s -X POST http://localhost:8545 \
    -H "Content-Type: application/json" \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": 22,
        \"method\": \"debug_traceCall\",
        \"params\": [
            {
                \"to\": \"$CONTRACT_ADDRESS\",
                \"data\": \"$CALL_DATA\"
            },
            \"latest\"
        ]
    }")

if echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
    echo "❌ Error:"
    echo "$RESULT" | jq .
else
    echo "✅ Success!"
    echo "Struct logs count:"
    echo "$RESULT" | jq '.result.structLogs | length'
    echo "First 3 struct logs:"
    echo "$RESULT" | jq '.result.structLogs[:3]'
fi

echo ""
echo "================================================================================"
echo "✅ All tests completed!"
echo "================================================================================"
echo "Contract Address: $CONTRACT_ADDRESS"
echo "Deployment TX: $DEPLOY_TX"
