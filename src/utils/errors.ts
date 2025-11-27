/**
 * Custom error classes for the Audit MCP Server
 */

export class ToolError extends Error {
  constructor(
    public readonly tool: string,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(`[${tool}:${code}] ${message}`);
    this.name = "ToolError";
  }
}

export class AuditMcpError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AuditMcpError";
  }
}

export class ReadSourceError extends AuditMcpError {
  constructor(message: string, details?: unknown) {
    super(message, "READ_SOURCE_ERROR", details);
    this.name = "ReadSourceError";
  }
}

export class SimulationError extends AuditMcpError {
  constructor(message: string, details?: unknown) {
    super(message, "SIMULATION_ERROR", details);
    this.name = "SimulationError";
  }
}

export class AnvilError extends AuditMcpError {
  constructor(message: string, details?: unknown) {
    super(message, "ANVIL_ERROR", details);
    this.name = "AnvilError";
  }
}

/**
 * Centralized error handler wrapper for tool registration
 */
export function wrapToolHandler<TInput, TOutput>(
  handler: (input: TInput) => Promise<TOutput>,
  toolName: string
): (input: TInput) => Promise<TOutput> {
  return async (input: TInput) => {
    try {
      return await handler(input);
    } catch (error) {
      if (error instanceof AuditMcpError || error instanceof ToolError) {
        // Log structured error
        console.error(`[${toolName}] ${(error as ToolError).code || 'ERROR'}: ${error.message}`, (error as any).details);
        throw error;
      }

      // Wrap unexpected errors
      const wrappedError = new AuditMcpError(
        `Unexpected error in ${toolName}: ${(error as Error).message}`,
        "INTERNAL_ERROR",
        { originalError: error }
      );
      console.error(`[${toolName}] INTERNAL_ERROR:`, error);
      throw wrappedError;
    }
  };
}
