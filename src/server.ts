import express, { Express, Request, Response } from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { getConfig } from "./config.js";
import { getStateManager } from "./state/manager.js";
import { AnvilManager } from "./anvil/manager.js";
import { registerAllTools } from "./tools/index.js";

export interface McpServerContext {
  app: Express;
  mcpServer: McpServer;
  anvilManager: AnvilManager;
}

export interface StdioMcpServerContext {
  mcpServer: McpServer;
  anvilManager: AnvilManager;
}

export async function createMcpServer(): Promise<McpServerContext> {
  const config = getConfig();

  // Initialize state manager
  const stateManager = getStateManager();
  console.log("State manager initialized");

  // Initialize Anvil manager
  const anvilManager = new AnvilManager(config);
  await anvilManager.initialize();
  console.log("Anvil manager initialized");

  // Create MCP server using high-level McpServer API
  const mcpServer = new McpServer({
    name: "audit-mcp-server",
    version: "1.0.0",
  });

  // Register tools using the new registerTool API
  registerAllTools(mcpServer);
  console.log("Tools registered");

  // Create Express app
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: "*",
      credentials: true,
    })
  );
  app.use(express.json());

  // Health check endpoint
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    });
  });

  // Metrics endpoint
  app.get("/metrics", async (_req: Request, res: Response) => {
    const deployments = await stateManager.listDeployments();
    const anvilInstances = await stateManager.listAnvilInstances();

    res.json({
      deployments: {
        total: deployments.length,
        byNetwork: deployments.reduce((acc: Record<string, number>, d) => {
          acc[d.network] = (acc[d.network] || 0) + 1;
          return acc;
        }, {}),
      },
      anvil: {
        instances: anvilManager.listInstances().length,
        running: anvilManager
          .listInstances()
          .filter((i) => i.status === "running").length,
        total: anvilInstances.length,
        totalRunning: anvilInstances.filter((i) => i.status === "running")
          .length,
      },
    });
  });

  // MCP endpoint using StreamableHTTPServerTransport
  app.post("/mcp", async (req: Request, res: Response) => {
    console.log("MCP request received");

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close();
    });

    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  return {
    app,
    mcpServer,
    anvilManager,
  };
}

export async function createStdioMcpServer(): Promise<StdioMcpServerContext> {
  const config = getConfig();

  // Initialize state manager
  getStateManager();
  console.error("State manager initialized");

  // Initialize Anvil manager
  const anvilManager = new AnvilManager(config);
  await anvilManager.initialize();
  console.error("Anvil manager initialized");

  // Create MCP server using high-level McpServer API
  const mcpServer = new McpServer({
    name: "audit-mcp-server",
    version: "1.0.0",
  });

  // Register tools using the new registerTool API
  registerAllTools(mcpServer);
  console.error("Tools registered");

  return {
    mcpServer,
    anvilManager,
  };
}
