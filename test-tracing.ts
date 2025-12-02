#!/usr/bin/env tsx

/**
 * Test script for trace_transaction and trace_call MCP tools
 * Tests various tracer types against deployed contract
 */

const MCP_SERVER_URL = 'http://localhost:3000';
const CONTRACT_ADDRESS = '0x5fbdb2315678afecb367f032d93f642f64180aa3';
const DEPLOYMENT_TX_HASH = '0x3f87a36555b1c0c6d1fb9a162c42e43323c2809e3fd25bbcc25df1c2bad50ae8';
const VALUE_FUNCTION_SELECTOR = '0x3fa4f245';

interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

class MCPClient {
  private sessionId: string | null = null;
  private requestId = 0;

  async connect(): Promise<void> {
    console.log('🔌 Connecting to MCP server SSE endpoint...');

    const response = await fetch(`${MCP_SERVER_URL}/sse`, {
      headers: {
        'Accept': 'text/event-stream',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to connect to SSE: ${response.status} ${response.statusText}`);
    }

    // Read just enough of the stream to get the session ID
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Look for the endpoint event
      if (buffer.includes('event: endpoint')) {
        const lines = buffer.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i] === 'event: endpoint' && i + 1 < lines.length) {
            const dataLine = lines[i + 1];
            if (dataLine.startsWith('data: ')) {
              const endpoint = dataLine.substring(6).trim();
              const match = endpoint.match(/sessionId=([^&]+)/);
              if (match) {
                this.sessionId = match[1];
                console.log(`✅ Connected with session ID: ${this.sessionId}`);
                reader.cancel(); // Close the SSE connection
                return;
              }
            }
          }
        }
      }
    }

    throw new Error('Failed to extract session ID from SSE response');
  }

  async initialize(): Promise<void> {
    console.log('🔧 Initializing MCP session...');

    await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'trace-test',
        version: '1.0.0',
      },
    });

    console.log('✅ MCP session initialized');
  }

  async callTool(name: string, args: Record<string, any>): Promise<any> {
    return this.sendRequest('tools/call', {
      name,
      arguments: args,
    });
  }

  private async sendRequest(method: string, params: any): Promise<any> {
    if (!this.sessionId) {
      throw new Error('Not connected to MCP server');
    }

    const id = ++this.requestId;
    const url = `${MCP_SERVER_URL}/messages?sessionId=${this.sessionId}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText}\n${text}`);
    }

    const result: MCPResponse = await response.json();

    if (result.error) {
      throw new Error(`MCP Error (${result.error.code}): ${result.error.message}`);
    }

    return result.result;
  }
}

async function testTraceTransaction(client: MCPClient) {
  console.log('\n' + '='.repeat(80));
  console.log('📍 TESTING trace_transaction');
  console.log('='.repeat(80));

  const tracers = [
    { name: 'callTracer', config: { tracer: 'callTracer' } },
    { name: 'prestateTracer', config: { tracer: 'prestateTracer' } },
    { name: '4byteTracer', config: { tracer: '4byteTracer' } },
    { name: 'No tracer (raw opcodes)', config: undefined },
  ];

  for (const { name, config } of tracers) {
    console.log(`\n📊 Testing: ${name}`);
    console.log('-'.repeat(80));

    try {
      const args: any = {
        txHash: DEPLOYMENT_TX_HASH,
        rpcUrl: 'http://localhost:8545',
      };

      if (config) {
        args.tracerConfig = config;
      }

      const result = await client.callTool('trace_transaction', args);

      console.log('✅ Success!');
      console.log('📄 Result preview:');
      const resultStr = JSON.stringify(result, null, 2);
      console.log(resultStr.substring(0, 1000));

      if (resultStr.length > 1000) {
        console.log('... (truncated, full result is ' + resultStr.length + ' characters)');
      }
    } catch (error: any) {
      console.log('❌ Error:', error.message);
    }
  }
}

async function testTraceCall(client: MCPClient) {
  console.log('\n' + '='.repeat(80));
  console.log('📍 TESTING trace_call');
  console.log('='.repeat(80));

  const tests = [
    { name: 'callTracer', config: { tracer: 'callTracer' } },
    { name: 'prestateTracer', config: { tracer: 'prestateTracer' } },
    { name: 'Raw opcode trace', config: undefined },
  ];

  for (const { name, config } of tests) {
    console.log(`\n📊 Testing: ${name} for value() function call`);
    console.log('-'.repeat(80));

    try {
      const args: any = {
        to: CONTRACT_ADDRESS,
        data: VALUE_FUNCTION_SELECTOR,
        rpcUrl: 'http://localhost:8545',
      };

      if (config) {
        args.tracerConfig = config;
      }

      const result = await client.callTool('trace_call', args);

      console.log('✅ Success!');
      console.log('📄 Result:');
      const resultStr = JSON.stringify(result, null, 2);

      if (resultStr.length > 1500) {
        console.log(resultStr.substring(0, 1500));
        console.log('... (truncated, full result is ' + resultStr.length + ' characters)');
      } else {
        console.log(resultStr);
      }
    } catch (error: any) {
      console.log('❌ Error:', error.message);
    }
  }
}

async function main() {
  console.log('🚀 MCP Tracing Tools Test Suite');
  console.log('='.repeat(80));
  console.log('Contract Address:', CONTRACT_ADDRESS);
  console.log('Deployment TX Hash:', DEPLOYMENT_TX_HASH);
  console.log('Test Function: value() [selector: ' + VALUE_FUNCTION_SELECTOR + ']');
  console.log('='.repeat(80));

  const client = new MCPClient();

  try {
    await client.connect();
    await client.initialize();

    await testTraceTransaction(client);
    await testTraceCall(client);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Test suite completed!');
    console.log('='.repeat(80));
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
