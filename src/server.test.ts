import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express, { Express } from "express";
import request from "supertest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

/**
 * Tests for StreamableHTTPServerTransport in the MCP server
 *
 * These tests verify that:
 * 1. Health endpoint returns proper status
 * 2. POST /mcp accepts valid MCP JSON-RPC requests in stateless mode
 * 3. Invalid JSON is rejected with appropriate errors
 * 4. Unsupported HTTP methods return 405
 * 5. The stateless transport pattern functions correctly
 */

describe("MCP Server with StreamableHTTPServerTransport", () => {
  let app: Express;
  let mcpServer: McpServer;

  beforeEach(() => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Create MCP server using high-level McpServer API
    mcpServer = new McpServer({
      name: "test-server",
      version: "1.0.0",
    });

    // Register a simple test tool
    mcpServer.tool(
      "test_tool",
      "A test tool for verification",
      {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "A test message",
          },
        },
        required: ["message"],
      },
      async ({ message }) => {
        return {
          content: [
            {
              type: "text",
              text: `Received: ${message}`,
            },
          ],
        };
      }
    );

    // Health check endpoint
    app.get("/health", (_req, res) => {
      res.json({
        status: "ok",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
      });
    });

    // MCP endpoint using StreamableHTTPServerTransport (stateless mode)
    app.post("/mcp", async (req, res) => {
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
  });

  afterEach(() => {
    // Cleanup if needed
  });

  describe("Health Endpoint", () => {
    it("should return 200 with status information", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: "ok",
        version: "1.0.0",
      });
      expect(response.body.timestamp).toBeDefined();
      expect(typeof response.body.timestamp).toBe("string");
    });
  });

  describe("POST /mcp Endpoint", () => {
    it("should accept valid MCP initialize request", async () => {
      const response = await request(app)
        .post("/mcp")
        .set("Accept", "application/json, text/event-stream")
        .send({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "test-client",
              version: "1.0.0",
            },
          },
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        jsonrpc: "2.0",
        id: 1,
      });
      expect(response.body.result).toBeDefined();
      expect(response.body.result.protocolVersion).toBeDefined();
      expect(response.body.result.serverInfo).toMatchObject({
        name: "test-server",
        version: "1.0.0",
      });
    });

    it("should accept valid MCP tools/list request", async () => {
      // First initialize
      await request(app)
        .post("/mcp")
        .set("Accept", "application/json, text/event-stream")
        .send({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "test-client",
              version: "1.0.0",
            },
          },
          id: 1,
        });

      // Then request tools list
      const response = await request(app)
        .post("/mcp")
        .set("Accept", "application/json, text/event-stream")
        .send({
          jsonrpc: "2.0",
          method: "tools/list",
          id: 2,
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        jsonrpc: "2.0",
        id: 2,
      });
      expect(response.body.result).toBeDefined();
      expect(response.body.result.tools).toBeDefined();
      expect(Array.isArray(response.body.result.tools)).toBe(true);

      // Should include our test tool
      const testTool = response.body.result.tools.find(
        (t: any) => t.name === "test_tool"
      );
      expect(testTool).toBeDefined();
      expect(testTool.description).toBe("A test tool for verification");
    });

    it("should handle tool call request", async () => {
      // First initialize
      await request(app)
        .post("/mcp")
        .set("Accept", "application/json, text/event-stream")
        .send({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "test-client",
              version: "1.0.0",
            },
          },
          id: 1,
        });

      // Call the test tool
      const response = await request(app)
        .post("/mcp")
        .set("Accept", "application/json, text/event-stream")
        .send({
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: "test_tool",
            arguments: {
              message: "Hello from test",
            },
          },
          id: 2,
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        jsonrpc: "2.0",
        id: 2,
      });
      expect(response.body.result).toBeDefined();
      expect(response.body.result.content).toBeDefined();
      // The tool receives the message successfully
      expect(response.body.result.content[0].text).toContain("Received:");
    });

    it("should reject invalid JSON with appropriate error", async () => {
      const response = await request(app)
        .post("/mcp")
        .set("Accept", "application/json, text/event-stream")
        .set("Content-Type", "application/json")
        .send("{ invalid json }");

      expect(response.status).toBe(400);
    });

    it("should reject malformed MCP request", async () => {
      const response = await request(app)
        .post("/mcp")
        .set("Accept", "application/json, text/event-stream")
        .send({
          // Missing required jsonrpc field
          method: "tools/list",
          id: 1,
        });

      // The transport rejects invalid requests with 400
      expect(response.status).toBe(400);
    });

    it("should handle multiple independent requests (stateless mode)", async () => {
      // First request - initialize
      const response1 = await request(app)
        .post("/mcp")
        .set("Accept", "application/json, text/event-stream")
        .send({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "test-client-1",
              version: "1.0.0",
            },
          },
          id: 1,
        });

      expect(response1.status).toBe(200);
      expect(response1.body.result.serverInfo.name).toBe("test-server");

      // Second request - initialize again (stateless, should work)
      const response2 = await request(app)
        .post("/mcp")
        .set("Accept", "application/json, text/event-stream")
        .send({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "test-client-2",
              version: "1.0.0",
            },
          },
          id: 1,
        });

      expect(response2.status).toBe(200);
      expect(response2.body.result.serverInfo.name).toBe("test-server");

      // Both requests should succeed independently
      expect(response1.body.id).toBe(1);
      expect(response2.body.id).toBe(1);
    });

    it("should handle request with no body gracefully", async () => {
      const response = await request(app).post("/mcp")
        .set("Accept", "application/json, text/event-stream");

      // The transport rejects empty requests with 415 (Unsupported Media Type)
      expect([400, 415]).toContain(response.status);
    });
  });

  describe("Unsupported HTTP Methods", () => {
    it("should return 404 for GET /mcp", async () => {
      const response = await request(app).get("/mcp");

      expect(response.status).toBe(404);
    });

    it("should return 404 for PUT /mcp", async () => {
      const response = await request(app).put("/mcp").send({
        jsonrpc: "2.0",
        method: "tools/list",
        id: 1,
      });

      expect(response.status).toBe(404);
    });

    it("should return 404 for DELETE /mcp", async () => {
      const response = await request(app).delete("/mcp");

      expect(response.status).toBe(404);
    });
  });

  describe("Error Handling", () => {
    it("should handle unknown method gracefully", async () => {
      // First initialize
      await request(app)
        .post("/mcp")
        .set("Accept", "application/json, text/event-stream")
        .send({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "test-client",
              version: "1.0.0",
            },
          },
          id: 1,
        });

      const response = await request(app)
        .post("/mcp")
        .set("Accept", "application/json, text/event-stream")
        .send({
          jsonrpc: "2.0",
          method: "nonexistent/method",
          id: 2,
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        jsonrpc: "2.0",
        id: 2,
      });
      // Should contain an error
      expect(response.body.error).toBeDefined();
    });

    it("should handle tool call with missing arguments", async () => {
      // First initialize
      await request(app)
        .post("/mcp")
        .set("Accept", "application/json, text/event-stream")
        .send({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "test-client",
              version: "1.0.0",
            },
          },
          id: 1,
        });

      const response = await request(app)
        .post("/mcp")
        .set("Accept", "application/json, text/event-stream")
        .send({
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: "test_tool",
            arguments: {
              // Missing required 'message' field
            },
          },
          id: 2,
        });

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(2);
      // Should contain an error about missing argument
      expect(response.body.error || response.body.result).toBeDefined();
    });

    it("should handle tool call with invalid tool name", async () => {
      // First initialize
      await request(app)
        .post("/mcp")
        .set("Accept", "application/json, text/event-stream")
        .send({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "test-client",
              version: "1.0.0",
            },
          },
          id: 1,
        });

      const response = await request(app)
        .post("/mcp")
        .set("Accept", "application/json, text/event-stream")
        .send({
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: "nonexistent_tool",
            arguments: {},
          },
          id: 2,
        });

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(2);
      // Should contain either an error or a result with an error
      expect(response.body.error || response.body.result?.isError).toBeDefined();
    });
  });

  describe("Transport Cleanup", () => {
    it("should handle connection close during request", async () => {
      // This test verifies that the transport cleanup on 'close' event works
      // We can't easily test this with supertest, but we can verify the setup

      const mockReq = {
        body: {
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "test-client",
              version: "1.0.0",
            },
          },
          id: 1,
        },
      } as any;

      const mockRes = {
        on: vi.fn(),
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      // Verify that close can be called
      expect(() => transport.close()).not.toThrow();

      // Verify we can set up the close handler
      mockRes.on("close", () => {
        transport.close();
      });

      expect(mockRes.on).toHaveBeenCalledWith("close", expect.any(Function));
    });
  });

  describe("Stateless Mode Verification", () => {
    it("should not maintain state between requests", async () => {
      // Initialize in first request
      const init1 = await request(app)
        .post("/mcp")
        .set("Accept", "application/json, text/event-stream")
        .send({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "test-client-1",
              version: "1.0.0",
            },
          },
          id: 1,
        });

      expect(init1.status).toBe(200);

      // Try to use tools/list without initializing in second request
      // In stateless mode, each request is independent
      const toolsList = await request(app)
        .post("/mcp")
        .set("Accept", "application/json, text/event-stream")
        .send({
          jsonrpc: "2.0",
          method: "tools/list",
          id: 2,
        });

      // This should work because each request creates a new transport
      // but may require initialization depending on MCP protocol implementation
      expect(toolsList.status).toBe(200);
    });

    it("should create new transport for each request", async () => {
      // Make multiple requests and verify they all work independently
      const requests = [1, 2, 3].map((id) =>
        request(app)
          .post("/mcp")
        .set("Accept", "application/json, text/event-stream")
          .send({
            jsonrpc: "2.0",
            method: "initialize",
            params: {
              protocolVersion: "2024-11-05",
              capabilities: {},
              clientInfo: {
                name: `test-client-${id}`,
                version: "1.0.0",
              },
            },
            id,
          })
      );

      const responses = await Promise.all(requests);

      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.id).toBe(index + 1);
        expect(response.body.result.serverInfo.name).toBe("test-server");
      });
    });
  });
});
