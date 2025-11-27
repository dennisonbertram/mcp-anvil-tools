import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

/**
 * Register all MCP tools with the server
 * Tools will be implemented in subsequent phases
 */
export function registerAllTools(server: Server) {
  console.log("Tool registration starting...");

  // Register tools/list handler
  // This is required for the MCP protocol even if no tools are registered yet
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [],
    };
  });

  // Phase 2: Environment tools
  // registerAnvilStartTool(server);
  // registerAnvilStopTool(server);
  // registerAnvilSnapshotTool(server);

  // Phase 3: Reading tools
  // registerReadSourceTool(server);
  // registerReadStorageTool(server);
  // registerReadAbiTool(server);
  // registerReadBytecodeTool(server);

  // Phase 4: Execution tools
  // registerSimulateTxTool(server);
  // registerSendTxTool(server);
  // registerDeployContractTool(server);
  // registerTraceTxTool(server);

  // Phase 5: Analysis tools (future)
  // registerParseAstTool(server);
  // registerCallGraphTool(server);
  // registerSlitherAnalyzeTool(server);

  console.log("Tool registration complete (0 tools registered - base implementation)");
}
