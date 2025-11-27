import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import { readingTools } from "./reading.js";
import { executionTools, executionToolSchemas } from "./execution.js";
import { tracingTools } from "./tracing.js";
import { ToolError } from "../utils/errors.js";

/**
 * Tool definition type
 */
interface ToolDefinition {
  description: string;
  handler: (input: any) => Promise<any>;
  inputSchema: z.ZodTypeAny;
}

/**
 * Tool definitions with metadata
 */
const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  // Reading Tools
  read_source: {
    description: "Read Solidity source code files from the v4-core repository. Returns content, line count, size, and metadata.",
    handler: readingTools.read_source.handler,
    inputSchema: readingTools.read_source.inputSchema,
  },
  read_storage: {
    description: "Read persistent storage slots from deployed contracts. Provides raw value and best-effort decoded interpretation. Note: Only reads persistent storage, not transient storage (TLOAD/TSTORE).",
    handler: readingTools.read_storage.handler,
    inputSchema: readingTools.read_storage.inputSchema,
  },
  read_bytecode: {
    description: "Retrieve deployed bytecode from a contract address. Returns bytecode, size, hash, and isEmpty flag.",
    handler: readingTools.read_bytecode.handler,
    inputSchema: readingTools.read_bytecode.inputSchema,
  },
  read_events: {
    description: "Query and decode event logs from the blockchain. Supports event signature parsing and block range filtering. Limited to 10k block ranges.",
    handler: readingTools.read_events.handler,
    inputSchema: readingTools.read_events.inputSchema,
  },
  // Execution Tools
  simulate_tx: {
    description: "Simulate transaction execution without sending. Supports state overrides, gas limits, and return value decoding. Use for testing before actual execution.",
    handler: executionTools.simulateTx,
    inputSchema: executionToolSchemas.simulateTx.input,
  },
  send_tx: {
    description: "Send actual transaction to the network. Supports contract deployment, ETH transfers, and function calls. Returns receipt with gas used, logs, and contract address (if deployment).",
    handler: executionTools.sendTx,
    inputSchema: executionToolSchemas.sendTx.input,
  },
  impersonate: {
    description: "Impersonate any address on Anvil for testing. Allows sending transactions from any address without private key. Anvil only - will fail on other networks.",
    handler: executionTools.impersonate,
    inputSchema: executionToolSchemas.impersonate.input,
  },
  create_snapshot: {
    description: "Create state snapshot on Anvil for reverting later. Captures current block state including balances, storage, and contracts. Snapshots are lost on node restart.",
    handler: executionTools.createSnapshot,
    inputSchema: executionToolSchemas.createSnapshot.input,
  },
  revert_snapshot: {
    description: "Revert Anvil state to a previously created snapshot. Useful for resetting test state. Note: Snapshot IDs are typically single-use and invalidated after revert.",
    handler: executionTools.revertSnapshot,
    inputSchema: executionToolSchemas.revertSnapshot.input,
  },
  // Tracing Tools
  trace_transaction: {
    description: "Trace an existing transaction by hash using debug_traceTransaction. Supports multiple tracer types: callTracer (call tree), prestateTracer (pre-execution state), 4byteTracer (function selectors), or raw opcode trace. Useful for debugging transaction execution and analyzing gas usage.",
    handler: tracingTools.trace_transaction.handler,
    inputSchema: tracingTools.trace_transaction.inputSchema,
  },
  trace_call: {
    description: "Trace a call without sending transaction using debug_traceCall. Similar to trace_transaction but simulates execution without broadcasting. Supports all tracer types and state inspection. Useful for debugging before sending actual transactions.",
    handler: tracingTools.trace_call.handler,
    inputSchema: tracingTools.trace_call.inputSchema,
  },
};

/**
 * Register all MCP tools with the server
 */
export function registerAllTools(server: Server) {
  console.log("Tool registration starting...");

  // Register ListTools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = Object.entries(TOOL_DEFINITIONS).map(([name, tool]) => {
      // Convert Zod schema to JSON Schema
      const jsonSchema = zodToJsonSchema(tool.inputSchema as any, {
        $refStrategy: "none",
      });

      // Remove $schema field if present to avoid conflicts with MCP protocol
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { $schema, ...schemaWithoutDollarSchema } = jsonSchema as any;

      return {
        name,
        description: tool.description,
        inputSchema: schemaWithoutDollarSchema,
      };
    });

    console.log(`Registered ${tools.length} tools:`, tools.map(t => t.name).join(", "));

    return { tools };
  });

  // Register CallTool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    console.log(`Tool called: ${name}`, args ? JSON.stringify(args).substring(0, 100) : "");

    const tool = TOOL_DEFINITIONS[name as keyof typeof TOOL_DEFINITIONS];
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    try {
      // Validate input against schema
      const validatedInput = tool.inputSchema.parse(args || {});

      // Execute tool handler
      const result = await tool.handler(validatedInput);

      // Return result as JSON text content
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      // Handle ToolError with structured details
      if (error instanceof ToolError) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: error.message,
                code: error.code,
                tool: error.tool,
                details: error.details,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      // Handle Zod validation errors
      if (error && typeof error === 'object' && 'issues' in error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Validation error",
                issues: (error as any).issues,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      // Handle generic errors
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: (error as Error).message || "Unknown error",
              stack: (error as Error).stack,
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  console.log("Tool registration complete - 11 tools registered");
}
