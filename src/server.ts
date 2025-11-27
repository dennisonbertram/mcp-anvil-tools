import express, { Express, Request, Response } from "express";
import cors from "cors";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { getConfig } from "./config.js";
import { getStateManager } from "./state/manager.js";
import { AnvilManager } from "./anvil/manager.js";
import { registerAllTools } from "./tools/index.js";

export interface McpServerContext {
  app: Express;
  mcpServer: Server;
  anvilManager: AnvilManager;
}

export interface StdioMcpServerContext {
  mcpServer: Server;
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

  // Create MCP server
  const mcpServer = new Server(
    {
      name: "audit-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Register tools
  registerAllTools(mcpServer);
  console.log("Tools registered");

  // Create Express app
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
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

  // MCP SSE endpoint
  app.get("/sse", async (_req: Request, res: Response) => {
    console.log("New SSE connection");
    const transport = new SSEServerTransport("/messages", res);
    await mcpServer.connect(transport);
  });

  // MCP message endpoint
  app.post("/messages", async (_req: Request, res: Response) => {
    // SSEServerTransport handles POST requests internally
    // This endpoint should not be called directly
    res.status(405).json({ error: "Method not allowed" });
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

  // Create MCP server
  const mcpServer = new Server(
    {
      name: "audit-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Register tools
  registerAllTools(mcpServer);
  console.error("Tools registered");

  return {
    mcpServer,
    anvilManager,
  };
}
