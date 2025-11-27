#!/usr/bin/env tsx
/**
 * Test script for stdio transport
 * Tests that the MCP server can:
 * 1. Start in stdio mode
 * 2. Handle initialize handshake
 * 3. List available tools
 */

import { spawn } from "child_process";
import { join } from "path";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

const SERVER_PATH = join(process.cwd(), "dist", "index.js");

async function testStdioTransport() {
  console.log("Starting stdio transport test...\n");

  // Start the server in stdio mode
  const server = spawn("node", [SERVER_PATH, "--stdio"], {
    cwd: process.cwd(),
    env: process.env,
  });

  let stderrOutput = "";
  let stdoutBuffer = "";
  const responses: JsonRpcResponse[] = [];

  // Collect stderr (logs)
  server.stderr.on("data", (data: Buffer) => {
    stderrOutput += data.toString();
  });

  // Parse JSON-RPC responses from stdout
  server.stdout.on("data", (data: Buffer) => {
    stdoutBuffer += data.toString();

    // Try to parse complete JSON objects
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line) as JsonRpcResponse;
          responses.push(response);
        } catch (e) {
          console.error("Failed to parse JSON:", line);
        }
      }
    }
  });

  // Wait for server to initialize
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log("1. Sending initialize request...");
  const initRequest: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "test-client",
        version: "1.0.0",
      },
    },
  };

  server.stdin.write(JSON.stringify(initRequest) + "\n");

  // Wait for initialize response
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const initResponse = responses.find((r) => r.id === 1);
  if (initResponse?.result) {
    console.log("   Initialize SUCCESS");
    console.log(
      "   Server info:",
      JSON.stringify((initResponse.result as { serverInfo?: unknown }).serverInfo, null, 2)
    );
  } else {
    console.log("   Initialize FAILED");
    console.log("   Response:", JSON.stringify(initResponse, null, 2));
  }

  console.log("\n2. Sending initialized notification...");
  const initializedNotification = {
    jsonrpc: "2.0",
    method: "notifications/initialized",
  };
  server.stdin.write(JSON.stringify(initializedNotification) + "\n");

  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log("\n3. Sending tools/list request...");
  const toolsRequest: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  };

  server.stdin.write(JSON.stringify(toolsRequest) + "\n");

  // Wait for tools response
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const toolsResponse = responses.find((r) => r.id === 2);
  if (toolsResponse?.result) {
    const tools = (toolsResponse.result as { tools?: Array<{ name: string }> }).tools || [];
    console.log(`   Tools/list SUCCESS - Found ${tools.length} tools`);
    console.log("   Available tools:");
    tools.forEach((tool) => {
      console.log(`     - ${tool.name}`);
    });
  } else {
    console.log("   Tools/list FAILED");
    console.log("   Response:", JSON.stringify(toolsResponse, null, 2));
  }

  // Cleanup
  server.kill("SIGTERM");

  await new Promise((resolve) => {
    server.on("exit", resolve);
  });

  console.log("\n--- Server Logs (stderr) ---");
  console.log(stderrOutput);

  console.log("\n--- Test Summary ---");
  console.log(`Total responses received: ${responses.length}`);
  console.log(
    `Initialize: ${initResponse?.result ? "PASS" : "FAIL"}`
  );
  console.log(
    `Tools/list: ${toolsResponse?.result ? "PASS" : "FAIL"}`
  );

  const allPassed =
    initResponse?.result && toolsResponse?.result;

  if (allPassed) {
    console.log("\n ALL TESTS PASSED!");
    process.exit(0);
  } else {
    console.log("\n SOME TESTS FAILED!");
    process.exit(1);
  }
}

testStdioTransport().catch((error) => {
  console.error("Test failed with error:", error);
  process.exit(1);
});
