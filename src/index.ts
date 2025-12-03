#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { getStateManager } from "./state/manager.js";
import { createMcpServer, createStdioMcpServer } from "./server.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

async function main() {
  try {
    // Check if stdio mode is requested
    const useStdio = process.argv.includes("--stdio");

    if (useStdio) {
      // STDIO mode - for CLI usage
      console.error("Starting MCP server in stdio mode...");

      // Create MCP server without HTTP
      const { mcpServer, anvilManager } = await createStdioMcpServer();
      console.error("MCP server initialized in stdio mode");

      // Connect via stdio transport
      const transport = new StdioServerTransport();
      await mcpServer.connect(transport);
      console.error("Connected to stdio transport");

      // Graceful shutdown for stdio
      const shutdown = async (signal: string) => {
        console.error(`\nReceived ${signal}, shutting down gracefully...`);

        // Stop all Anvil instances
        await anvilManager.stopAll();
        console.error("All Anvil instances stopped");

        // Close database
        const stateManager = getStateManager();
        stateManager.close();
        console.error("Database closed");

        console.error("Shutdown complete");
        process.exit(0);
      };

      process.on("SIGTERM", () => shutdown("SIGTERM"));
      process.on("SIGINT", () => shutdown("SIGINT"));
    } else {
      // HTTP mode - for web usage (using StreamableHTTPServerTransport)
      const config = loadConfig();
      console.log("Configuration loaded");
      console.log(`  Port: ${config.port}`);
      console.log(`  Host: ${config.host}`);
      console.log(`  Database: ${config.dbPath}`);
      console.log(
        `  Anvil ports: ${config.anvilPortStart}-${config.anvilPortEnd}`
      );

      // Create MCP server and Express app
      const { app, anvilManager } = await createMcpServer();
      console.log("MCP server initialized");

      // Start HTTP server
      const server = app.listen(config.port, config.host, () => {
        console.log(`\nAudit MCP Server running:`);
        console.log(`  HTTP: http://${config.host}:${config.port}`);
        console.log(`  MCP:  http://${config.host}:${config.port}/mcp`);
        console.log(`  Health: http://${config.host}:${config.port}/health`);
        console.log(`\nReady to accept connections.`);
      });

      // Graceful shutdown
      const shutdown = async (signal: string) => {
        console.log(`\nReceived ${signal}, shutting down gracefully...`);

        // Stop accepting new connections
        server.close(() => {
          console.log("HTTP server closed");
        });

        // Stop all Anvil instances
        await anvilManager.stopAll();
        console.log("All Anvil instances stopped");

        // Close database
        const stateManager = getStateManager();
        stateManager.close();
        console.log("Database closed");

        console.log("Shutdown complete");
        process.exit(0);
      };

      process.on("SIGTERM", () => shutdown("SIGTERM"));
      process.on("SIGINT", () => shutdown("SIGINT"));
    }
  } catch (error) {
    console.error("Fatal error during startup:", error);
    process.exit(1);
  }
}

main();
