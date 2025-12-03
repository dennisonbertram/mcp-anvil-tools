/**
 * Tool Registration Orchestrator
 *
 * Registers all MCP tools with the McpServer using the high-level registerTool API.
 * This orchestrator delegates to domain-specific registration functions.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerReadingTools } from "./reading.js";
import { registerExecutionTools } from "./execution.js";
import { registerTracingTools } from "./tracing.js";

/**
 * Register all MCP tools with the server
 *
 * Tools registered:
 * - Reading (4): read_source, read_storage, read_bytecode, read_events
 * - Execution (5): simulate_tx, send_tx, impersonate, create_snapshot, revert_snapshot
 * - Tracing (2): trace_transaction, trace_call
 *
 * Total: 11 tools
 */
export function registerAllTools(server: McpServer) {
  console.log("Tool registration starting...");

  // Register reading tools (4 tools)
  registerReadingTools(server);

  // Register execution tools (5 tools)
  registerExecutionTools(server);

  // Register tracing tools (2 tools)
  registerTracingTools(server);

  console.log("Tool registration complete - 11 tools registered");
}
