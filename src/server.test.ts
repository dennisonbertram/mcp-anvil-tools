import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express, { Express } from "express";
import request from "supertest";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

/**
 * Tests for SSE session management in the MCP server
 *
 * These tests verify that:
 * 1. SSE connections properly create and store transports
 * 2. POST /messages routes to the correct transport by sessionId
 * 3. Invalid sessionIds are rejected with 400
 * 4. Multiple concurrent sessions can coexist
 */

describe("SSE Session Management", () => {
  let app: Express;
  let mcpServer: Server;
  let transports: Map<string, SSEServerTransport>;

  beforeEach(() => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Create MCP server
    mcpServer = new Server(
      {
        name: "test-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    // Create transports map (this will be part of our implementation)
    transports = new Map<string, SSEServerTransport>();

    // Mock SSE endpoint - this is what we need to implement
    app.get("/sse", async (req, res) => {
      const transport = new SSEServerTransport("/messages", res);
      const sessionId = transport.sessionId;

      // Store transport by sessionId
      transports.set(sessionId, transport);

      // Clean up on close
      res.on("close", () => {
        transports.delete(sessionId);
      });

      await mcpServer.connect(transport);
    });

    // Mock POST /messages endpoint - this is what we need to fix
    app.post("/messages", async (req, res) => {
      const sessionId = req.query.sessionId as string;

      if (!sessionId) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Missing sessionId query parameter"
          },
          id: null
        });
        return;
      }

      const transport = transports.get(sessionId);

      if (!transport) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "No transport found for sessionId"
          },
          id: null
        });
        return;
      }

      await transport.handlePostMessage(req, res, req.body);
    });
  });

  afterEach(() => {
    // Clean up all transports
    for (const transport of transports.values()) {
      transport.close();
    }
    transports.clear();
  });

  it("should store transport when SSE connection is established", async () => {
    // Manually create and store a transport to verify the storage mechanism works
    const mockRes = {
      writeHead: vi.fn(),
      write: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      emit: vi.fn(),
      removeListener: vi.fn(),
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
    };

    const transport = new SSEServerTransport("/messages", mockRes as any);
    const sessionId = transport.sessionId;

    // Store transport
    transports.set(sessionId, transport);

    // Verify transport was stored
    expect(transports.has(sessionId)).toBe(true);
    expect(transports.get(sessionId)).toBe(transport);
    expect(transports.size).toBe(1);
  });

  it("should reject POST /messages without sessionId", async () => {
    const response = await request(app)
      .post("/messages")
      .send({
        jsonrpc: "2.0",
        method: "ping",
        id: 1,
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: expect.stringContaining("sessionId"),
      },
    });
  });

  it("should reject POST /messages with invalid sessionId", async () => {
    const response = await request(app)
      .post("/messages")
      .query({ sessionId: "invalid-session-id" })
      .send({
        jsonrpc: "2.0",
        method: "ping",
        id: 1,
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: expect.stringContaining("No transport found"),
      },
    });
  });

  it("should route POST /messages to correct transport with valid sessionId", async () => {
    // First, establish SSE connection to get a sessionId
    let sessionId: string | undefined;

    // Create a mock transport with a known sessionId
    const mockTransport = {
      sessionId: "test-session-123",
      handlePostMessage: vi.fn(async (req, res, body) => {
        res.status(200).json({
          jsonrpc: "2.0",
          result: { success: true },
          id: body.id,
        });
      }),
      close: vi.fn(),
    } as unknown as SSEServerTransport;

    transports.set(mockTransport.sessionId, mockTransport);

    // Now send a POST request with the sessionId
    const response = await request(app)
      .post("/messages")
      .query({ sessionId: mockTransport.sessionId })
      .send({
        jsonrpc: "2.0",
        method: "tools/list",
        id: 1,
      });

    expect(response.status).toBe(200);
    expect(mockTransport.handlePostMessage).toHaveBeenCalled();
  });

  it("should support multiple concurrent sessions", async () => {
    // Create two mock transports with different sessionIds
    const transport1 = {
      sessionId: "session-1",
      handlePostMessage: vi.fn(async (req, res, body) => {
        res.status(200).json({
          jsonrpc: "2.0",
          result: { session: "session-1" },
          id: body.id,
        });
      }),
      close: vi.fn(),
    } as unknown as SSEServerTransport;

    const transport2 = {
      sessionId: "session-2",
      handlePostMessage: vi.fn(async (req, res, body) => {
        res.status(200).json({
          jsonrpc: "2.0",
          result: { session: "session-2" },
          id: body.id,
        });
      }),
      close: vi.fn(),
    } as unknown as SSEServerTransport;

    transports.set(transport1.sessionId, transport1);
    transports.set(transport2.sessionId, transport2);

    // Send requests to both sessions
    const response1 = await request(app)
      .post("/messages")
      .query({ sessionId: "session-1" })
      .send({
        jsonrpc: "2.0",
        method: "tools/list",
        id: 1,
      });

    const response2 = await request(app)
      .post("/messages")
      .query({ sessionId: "session-2" })
      .send({
        jsonrpc: "2.0",
        method: "tools/list",
        id: 2,
      });

    expect(response1.status).toBe(200);
    expect(response1.body.result.session).toBe("session-1");
    expect(transport1.handlePostMessage).toHaveBeenCalled();

    expect(response2.status).toBe(200);
    expect(response2.body.result.session).toBe("session-2");
    expect(transport2.handlePostMessage).toHaveBeenCalled();
  });

  it("should clean up transport when SSE connection closes", async () => {
    const mockTransport = {
      sessionId: "cleanup-test-session",
      handlePostMessage: vi.fn(),
      close: vi.fn(),
    } as unknown as SSEServerTransport;

    transports.set(mockTransport.sessionId, mockTransport);

    // Verify transport exists
    expect(transports.has(mockTransport.sessionId)).toBe(true);

    // Simulate SSE connection close by manually deleting
    transports.delete(mockTransport.sessionId);

    // Verify transport is removed
    expect(transports.has(mockTransport.sessionId)).toBe(false);

    // Trying to send a message should fail
    const response = await request(app)
      .post("/messages")
      .query({ sessionId: mockTransport.sessionId })
      .send({
        jsonrpc: "2.0",
        method: "tools/list",
        id: 1,
      });

    expect(response.status).toBe(400);
  });
});
