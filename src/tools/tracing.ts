/**
 * Tracing Tools for MCP Server
 *
 * Provides tools for tracing transactions and calls using debug_traceTransaction
 * and debug_traceCall RPC methods. Supports multiple tracer types including
 * callTracer, prestateTracer, 4byteTracer, and raw opcode traces.
 */

import { z } from "zod";
import { createPublicClient, http } from "viem";
import { ToolError } from "../utils/errors.js";

// ============================================================================
// 1. trace_transaction - Trace existing transaction by hash
// ============================================================================

export const TraceTransactionInputSchema = z.object({
  txHash: z.string()
    .describe("Transaction hash to trace")
    .refine(
      (hash) => /^0x[a-fA-F0-9]{64}$/.test(hash),
      "Invalid transaction hash format"
    ),
  tracer: z.enum(['callTracer', 'prestateTracer', '4byteTracer'])
    .optional()
    .describe("Tracer type: callTracer (call tree), prestateTracer (pre-state), 4byteTracer (function selectors), or omit for raw opcode trace"),
  tracerConfig: z.record(z.any())
    .optional()
    .describe("Tracer-specific configuration (e.g., {onlyTopCall: true} for callTracer)"),
  rpc: z.string()
    .url()
    .optional()
    .default('http://localhost:8545')
    .describe("RPC URL")
});

export const TraceTransactionOutputSchema = z.object({
  result: z.any()
    .describe("Trace result - format depends on tracer type"),
  txHash: z.string()
    .describe("Transaction hash that was traced")
});

export type TraceTransactionInput = z.infer<typeof TraceTransactionInputSchema>;
export type TraceTransactionOutput = z.infer<typeof TraceTransactionOutputSchema>;

/**
 * Trace an existing transaction by hash using debug_traceTransaction
 *
 * Returns different output based on tracer type:
 * - callTracer: Call tree with type, from, to, value, gas, input, output
 * - prestateTracer: Pre-execution state of touched accounts
 * - 4byteTracer: Function selectors called during execution
 * - No tracer: Full opcode trace with structLogs
 *
 * @param input - Transaction hash and tracer configuration
 * @returns Trace result
 * @throws ToolError with codes: RPC_ERROR
 */
export async function traceTransaction(input: TraceTransactionInput): Promise<TraceTransactionOutput> {
  // Validate input first (throws if invalid)
  const validated = TraceTransactionInputSchema.parse(input);

  const client = createPublicClient({
    transport: http(validated.rpc, {
      timeout: 60_000, // Tracing can take a while
      retryCount: 3,
      retryDelay: 1000
    })
  });

  try {
    // Build tracer config object
    const tracerConfig: Record<string, unknown> = {};

    if (validated.tracer) {
      tracerConfig.tracer = validated.tracer;
    }

    if (validated.tracerConfig) {
      tracerConfig.tracerConfig = validated.tracerConfig;
    }

    // Call debug_traceTransaction RPC method
    const result = await client.request({
      method: 'debug_traceTransaction' as any,
      params: [validated.txHash as `0x${string}`, tracerConfig] as any
    });

    return {
      result,
      txHash: validated.txHash
    };
  } catch (error) {
    throw new ToolError(
      'trace_transaction',
      'RPC_ERROR',
      `Failed to trace transaction ${validated.txHash}: ${(error as Error).message}`,
      { txHash: validated.txHash, error: (error as Error).message }
    );
  }
}

// ============================================================================
// 2. trace_call - Trace a call without sending transaction
// ============================================================================

export const TraceCallInputSchema = z.object({
  to: z.string()
    .describe("Target contract address")
    .refine(
      (addr) => /^0x[a-fA-F0-9]{40}$/.test(addr),
      "Invalid address format"
    ),
  data: z.string()
    .describe("Calldata (hex encoded)")
    .refine(
      (data) => /^0x[a-fA-F0-9]*$/.test(data),
      "Invalid hex data format"
    ),
  from: z.string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional()
    .describe("Sender address"),
  value: z.string()
    .regex(/^0x[a-fA-F0-9]+$/)
    .optional()
    .describe("ETH value in wei (hex)"),
  blockTag: z.union([
    z.string().regex(/^0x[a-fA-F0-9]+$/),
    z.enum(["latest", "earliest", "pending", "safe", "finalized"])
  ])
    .optional()
    .default("latest")
    .describe("Block to trace at (default: latest)"),
  tracer: z.enum(['callTracer', 'prestateTracer', '4byteTracer'])
    .optional()
    .describe("Tracer type: callTracer, prestateTracer, 4byteTracer, or omit for raw opcode trace"),
  tracerConfig: z.record(z.any())
    .optional()
    .describe("Tracer-specific configuration"),
  rpc: z.string()
    .url()
    .optional()
    .default('http://localhost:8545')
    .describe("RPC URL")
});

export const TraceCallOutputSchema = z.object({
  result: z.any()
    .describe("Trace result - format depends on tracer type")
});

export type TraceCallInput = z.infer<typeof TraceCallInputSchema>;
export type TraceCallOutput = z.infer<typeof TraceCallOutputSchema>;

/**
 * Trace a call without sending transaction using debug_traceCall
 *
 * Similar to trace_transaction but simulates a call without executing it on-chain.
 * Useful for debugging contract calls before sending actual transactions.
 *
 * @param input - Call parameters and tracer configuration
 * @returns Trace result
 * @throws ToolError with codes: RPC_ERROR
 */
export async function traceCall(input: TraceCallInput): Promise<TraceCallOutput> {
  // Validate input first (throws if invalid)
  const validated = TraceCallInputSchema.parse(input);

  const client = createPublicClient({
    transport: http(validated.rpc, {
      timeout: 60_000,
      retryCount: 3,
      retryDelay: 1000
    })
  });

  try {
    // Build call object
    const callObject: Record<string, unknown> = {
      to: validated.to,
      data: validated.data
    };

    if (validated.from) {
      callObject.from = validated.from;
    }

    if (validated.value) {
      callObject.value = validated.value;
    }

    // Build tracer config
    const tracerConfig: Record<string, unknown> = {};

    if (validated.tracer) {
      tracerConfig.tracer = validated.tracer;
    }

    if (validated.tracerConfig) {
      tracerConfig.tracerConfig = validated.tracerConfig;
    }

    // Call debug_traceCall RPC method
    const result = await client.request({
      method: 'debug_traceCall' as any,
      params: [callObject, validated.blockTag || 'latest', tracerConfig] as any
    });

    return {
      result
    };
  } catch (error) {
    throw new ToolError(
      'trace_call',
      'RPC_ERROR',
      `Failed to trace call to ${validated.to}: ${(error as Error).message}`,
      { to: validated.to, error: (error as Error).message }
    );
  }
}

// ============================================================================
// Tool Registration Helper
// ============================================================================

/**
 * Export all tracing tools
 */
export const tracingTools = {
  trace_transaction: {
    inputSchema: TraceTransactionInputSchema,
    outputSchema: TraceTransactionOutputSchema,
    handler: traceTransaction
  },
  trace_call: {
    inputSchema: TraceCallInputSchema,
    outputSchema: TraceCallOutputSchema,
    handler: traceCall
  }
};
