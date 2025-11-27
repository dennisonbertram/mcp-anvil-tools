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

  // Store SSE transports by sessionId for message routing
  const transports = new Map<string, SSEServerTransport>();

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
    const sessionId = transport.sessionId;

    // Store transport by sessionId for message routing
    transports.set(sessionId, transport);
    console.log(`SSE transport stored for session: ${sessionId}`);

    // Clean up transport when connection closes
    res.on("close", () => {
      transports.delete(sessionId);
      console.log(`SSE transport removed for session: ${sessionId}`);
    });

    await mcpServer.connect(transport);
  });

  // MCP message endpoint - routes messages to the correct SSE transport
  app.post("/messages", async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;

    if (!sessionId) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Missing sessionId query parameter",
        },
        id: null,
      });
      return;
    }

    const transport = transports.get(sessionId);

    if (!transport) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "No transport found for sessionId",
        },
        id: null,
      });
      return;
    }

    // Route the message to the correct transport
    await transport.handlePostMessage(req, res, req.body);
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
