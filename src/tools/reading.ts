/**
 * Reading Tools for MCP Server
 *
 * Provides tools for reading Solidity source code, contract storage, bytecode, and events.
 * Based on reading-tools-spec.md
 */

import { z } from "zod";
import { createPublicClient, http, getAddress, keccak256, parseAbiItem, decodeEventLog } from "viem";
import fs from "fs/promises";
import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolError } from "../utils/errors.js";

// ============================================================================
// 1. read_source - Read Solidity source files
// ============================================================================

export const ReadSourceInputSchema = z.object({
  path: z.string()
    .describe("Relative path from lib/v4-core/src/ (e.g., 'PoolManager.sol', 'libraries/Pool.sol')")
    .refine(
      (p) => !p.startsWith('/') && !p.includes('..'),
      "Path must be relative and not contain '..' traversal"
    )
});

export const ReadSourceOutputSchema = z.object({
  content: z.string()
    .describe("Full source code content"),
  lines: z.number()
    .describe("Total number of lines"),
  path: z.string()
    .describe("Absolute path to the file"),
  size: z.number()
    .describe("File size in bytes"),
  lastModified: z.string()
    .describe("ISO timestamp of last modification")
});

export type ReadSourceInput = z.infer<typeof ReadSourceInputSchema>;
export type ReadSourceOutput = z.infer<typeof ReadSourceOutputSchema>;

/**
 * Read Solidity source code files from the v4-core repository
 *
 * @param input - Path to the contract file relative to lib/v4-core/src/
 * @returns Source code content and metadata
 * @throws ToolError with codes: PATH_TRAVERSAL, FILE_NOT_FOUND
 */
export async function readSource(input: ReadSourceInput): Promise<ReadSourceOutput> {
  try {
    // Resolve base path relative to current working directory
    const basePath = await fs.realpath(path.resolve(process.cwd(), 'lib/v4-core/src'));
    const absolutePath = await fs.realpath(path.resolve(basePath, input.path));

    // Security: Ensure path is within allowed directory using realpath
    // This prevents symlink-based path traversal attacks
    const relativePath = path.relative(basePath, absolutePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new ToolError(
        'read_source',
        'PATH_TRAVERSAL',
        'Path traversal detected: path must be within lib/v4-core/src/',
        { provided: input.path }
      );
    }

    // Read file and get stats
    const [content, stats] = await Promise.all([
      fs.readFile(absolutePath, 'utf-8'),
      fs.stat(absolutePath)
    ]);

    // Count lines
    const lines = content.split('\n').length;

    return {
      content,
      lines,
      path: absolutePath,
      size: stats.size,
      lastModified: stats.mtime.toISOString()
    };
  } catch (error) {
    if (error instanceof ToolError) {
      throw error;
    }
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ToolError(
        'read_source',
        'FILE_NOT_FOUND',
        `File not found: ${input.path}. Check that the path is relative to lib/v4-core/src/`,
        { path: input.path }
      );
    }
    throw new ToolError(
      'read_source',
      'READ_ERROR',
      `Failed to read file: ${(error as Error).message}`,
      { path: input.path }
    );
  }
}

// ============================================================================
// 2. read_storage - Read contract storage slots
// ============================================================================

export const ReadStorageInputSchema = z.object({
  address: z.string()
    .describe("Contract address")
    .refine(
      (addr) => /^0x[a-fA-F0-9]{40}$/.test(addr),
      "Invalid address format"
    ),
  slot: z.string()
    .describe("Storage slot as hex (e.g., '0x0', '0x1')")
    .refine(
      (slot) => /^0x[a-fA-F0-9]+$/.test(slot),
      "Invalid slot format"
    ),
  blockTag: z.union([
    z.literal('latest'),
    z.literal('earliest'),
    z.literal('pending'),
    z.number(),
    z.string()
  ])
    .optional()
    .default('latest')
    .describe("Block tag: 'latest', 'earliest', 'pending', block number, or block hash"),
  rpc: z.string()
    .url()
    .optional()
    .default('http://localhost:8545')
    .describe("RPC URL")
});

export const ReadStorageOutputSchema = z.object({
  value: z.string()
    .describe("Raw storage value (32-byte hex)"),
  decoded: z.union([
    z.object({
      type: z.literal('uint256'),
      value: z.string()
    }),
    z.object({
      type: z.literal('address'),
      value: z.string()
    }),
    z.object({
      type: z.literal('bool'),
      value: z.boolean()
    }),
    z.object({
      type: z.literal('bytes32'),
      value: z.string()
    })
  ]).optional()
    .describe("Decoded value (best-effort interpretation)")
});

export type ReadStorageInput = z.infer<typeof ReadStorageInputSchema>;
export type ReadStorageOutput = z.infer<typeof ReadStorageOutputSchema>;

/**
 * Read persistent storage slots from deployed contracts
 *
 * NOTE: This reads persistent storage only. Transient storage (TLOAD/TSTORE)
 * cannot be read via eth_getStorageAt. Use read_trace for transient storage analysis.
 *
 * @param input - Address, slot, and optional block tag
 * @returns Raw storage value and optional decoded interpretation
 * @throws ToolError with code: RPC_ERROR
 */
export async function readStorage(input: ReadStorageInput): Promise<ReadStorageOutput> {
  const client = createPublicClient({
    transport: http(input.rpc, {
      timeout: 30_000,
      retryCount: 3,
      retryDelay: 1000
    })
  });

  try {
    // Normalize address
    const normalizedAddress = getAddress(input.address);

    // Parse blockTag
    let storageParams: any;
    if (typeof input.blockTag === 'number') {
      storageParams = {
        address: normalizedAddress,
        slot: input.slot as `0x${string}`,
        blockNumber: BigInt(input.blockTag)
      };
    } else if (typeof input.blockTag === 'string' && input.blockTag.startsWith('0x')) {
      // Block hash
      storageParams = {
        address: normalizedAddress,
        slot: input.slot as `0x${string}`,
        blockHash: input.blockTag as `0x${string}`
      };
    } else {
      // 'latest', 'earliest', 'pending'
      storageParams = {
        address: normalizedAddress,
        slot: input.slot as `0x${string}`
      };
    }

    // Read storage using eth_getStorageAt
    const value = await client.getStorageAt(storageParams) || '0x' + '0'.repeat(64);

    // Ensure value is properly padded to 32 bytes (64 hex chars)
    const paddedValue = value.length === 66 ? value : '0x' + value.slice(2).padStart(64, '0');

    // Attempt to decode
    const decoded = attemptDecode(paddedValue);

    return {
      value: paddedValue,
      decoded
    };
  } catch (error) {
    throw new ToolError(
      'read_storage',
      'RPC_ERROR',
      `Failed to read storage from ${input.address} slot ${input.slot}`,
      { address: input.address, slot: input.slot, error: (error as Error).message }
    );
  }
}

/**
 * Attempt to decode storage value as common types
 */
function attemptDecode(value: string): ReadStorageOutput['decoded'] {
  const bytes = value.slice(2);
  const bigIntValue = BigInt(value);

  // Try as address (if left-padded zeros and last 20 bytes valid)
  if (bytes.slice(0, 24) === '0'.repeat(24)) {
    const addr = '0x' + bytes.slice(24);
    if (/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      try {
        return { type: 'address', value: getAddress(addr) };
      } catch {
        // Not a valid address
      }
    }
  }

  // Try as bool
  if (bigIntValue === 0n || bigIntValue === 1n) {
    return { type: 'bool', value: bigIntValue === 1n };
  }

  // Default to uint256 (as string to preserve precision)
  return { type: 'uint256', value: bigIntValue.toString() };
}

// ============================================================================
// 3. read_bytecode - Get deployed bytecode
// ============================================================================

export const ReadBytecodeInputSchema = z.object({
  address: z.string()
    .describe("Contract address (checksummed or lowercase)")
    .refine(
      (addr) => /^0x[a-fA-F0-9]{40}$/.test(addr),
      "Invalid Ethereum address format"
    ),
  blockTag: z.union([
    z.literal('latest'),
    z.literal('earliest'),
    z.literal('pending'),
    z.number(),
    z.string()
  ])
    .optional()
    .default('latest')
    .describe("Block tag: 'latest', 'earliest', 'pending', block number, or block hash"),
  rpc: z.string()
    .url()
    .optional()
    .default('http://localhost:8545')
    .describe("RPC URL")
});

export const ReadBytecodeOutputSchema = z.object({
  bytecode: z.string()
    .describe("Hex-encoded bytecode (with 0x prefix)"),
  size: z.number()
    .describe("Bytecode size in bytes"),
  codeHash: z.string()
    .describe("Keccak256 hash of the bytecode"),
  isEmpty: z.boolean()
    .describe("True if address has no code (EOA or not deployed)")
});

export type ReadBytecodeInput = z.infer<typeof ReadBytecodeInputSchema>;
export type ReadBytecodeOutput = z.infer<typeof ReadBytecodeOutputSchema>;

/**
 * Retrieve deployed bytecode from a contract address
 *
 * @param input - Address and optional block tag
 * @returns Bytecode, size, hash, and isEmpty flag
 * @throws ToolError with codes: UNSUPPORTED_BLOCK_TAG, RPC_ERROR
 */
export async function readBytecode(input: ReadBytecodeInput): Promise<ReadBytecodeOutput> {
  const client = createPublicClient({
    transport: http(input.rpc, {
      timeout: 30_000,
      retryCount: 3,
      retryDelay: 1000
    })
  });

  try {
    // Normalize address using viem's getAddress
    const normalizedAddress = getAddress(input.address);

    // Parse blockTag
    let blockNumber: bigint | undefined;
    if (typeof input.blockTag === 'number') {
      blockNumber = BigInt(input.blockTag);
    } else if (typeof input.blockTag === 'string' && input.blockTag.startsWith('0x')) {
      // Block hash - getBytecode doesn't support block hash directly
      throw new ToolError(
        'read_bytecode',
        'UNSUPPORTED_BLOCK_TAG',
        'Block hash not supported, use block number instead',
        { blockTag: input.blockTag }
      );
    } else {
      // 'latest', 'earliest', 'pending' - use undefined for latest
      blockNumber = input.blockTag === 'latest' ? undefined : (input.blockTag === 'earliest' ? 0n : undefined);
    }

    const bytecode = await client.getBytecode({
      address: normalizedAddress,
      blockNumber
    });

    // Handle case where address has no code
    if (!bytecode || bytecode === '0x') {
      return {
        bytecode: '0x',
        size: 0,
        codeHash: keccak256('0x'),
        isEmpty: true
      };
    }

    // Calculate size (remove 0x prefix, divide by 2 for bytes)
    const size = (bytecode.length - 2) / 2;

    // Compute code hash
    const codeHash = keccak256(bytecode);

    return {
      bytecode,
      size,
      codeHash,
      isEmpty: false
    };
  } catch (error) {
    if (error instanceof ToolError) {
      throw error;
    }
    throw new ToolError(
      'read_bytecode',
      'RPC_ERROR',
      `Failed to read bytecode from ${input.address}`,
      { address: input.address, error: (error as Error).message }
    );
  }
}

// ============================================================================
// 4. read_events - Query contract events
// ============================================================================

export const ReadEventsInputSchema = z.object({
  address: z.string()
    .describe("Contract address to query events from")
    .refine(
      (addr) => /^0x[a-fA-F0-9]{40}$/.test(addr),
      "Invalid address format"
    ),
  eventSignature: z.string()
    .optional()
    .describe("Event signature (e.g., 'Transfer(address,address,uint256)')"),
  topics: z.array(z.string())
    .optional()
    .describe("Indexed topics to filter (topic0 is event signature hash)"),
  fromBlock: z.union([z.number(), z.literal('earliest')])
    .optional()
    .default('earliest')
    .describe("Starting block number"),
  toBlock: z.union([z.number(), z.literal('latest')])
    .optional()
    .default('latest')
    .describe("Ending block number"),
  rpc: z.string()
    .url()
    .optional()
    .default('http://localhost:8545')
    .describe("RPC URL")
});

export const EventLogSchema = z.object({
  blockNumber: z.string()
    .describe("Block number"),
  blockHash: z.string()
    .describe("Block hash"),
  transactionHash: z.string()
    .describe("Transaction hash"),
  transactionIndex: z.number()
    .describe("Transaction index in block"),
  logIndex: z.number()
    .describe("Log index in transaction"),
  address: z.string()
    .describe("Contract address that emitted log"),
  topics: z.array(z.string())
    .describe("Indexed event topics"),
  data: z.string()
    .describe("Non-indexed event data"),
  decoded: z.object({
    eventName: z.string(),
    args: z.record(z.string(), z.any())
  }).optional()
    .describe("Decoded event (if signature provided)")
});

export const ReadEventsOutputSchema = z.object({
  events: z.array(EventLogSchema)
    .describe("Array of event logs"),
  count: z.number()
    .describe("Total number of events returned"),
  fromBlock: z.string()
    .describe("Actual starting block queried"),
  toBlock: z.string()
    .describe("Actual ending block queried")
});

export type ReadEventsInput = z.infer<typeof ReadEventsInputSchema>;
export type ReadEventsOutput = z.infer<typeof ReadEventsOutputSchema>;

/**
 * Query and decode event logs from the blockchain
 *
 * @param input - Address, event signature, and block range
 * @returns Array of event logs with optional decoding
 * @throws ToolError with codes: BLOCK_RANGE_TOO_LARGE, RPC_ERROR
 */
export async function readEvents(input: ReadEventsInput): Promise<ReadEventsOutput> {
  const client = createPublicClient({
    transport: http(input.rpc, {
      timeout: 30_000,
      retryCount: 3,
      retryDelay: 1000
    })
  });

  try {
    // Normalize address
    const normalizedAddress = getAddress(input.address);

    // Compute event signature hash if provided
    let eventAbi: any;
    let computedTopic0: string | undefined;

    if (input.eventSignature) {
      // Use viem's parseAbiItem for robust parsing
      eventAbi = parseAbiItem(`event ${input.eventSignature}`);
      computedTopic0 = keccak256(Buffer.from(input.eventSignature));
    }

    // Merge topics: use provided topics but fill topic0 if needed
    let topicsArray: `0x${string}`[] | undefined;
    if (input.topics) {
      topicsArray = input.topics as `0x${string}`[];
      // If topic0 is null/undefined and we have a signature, fill it
      if (computedTopic0 && topicsArray.length === 0) {
        topicsArray = [computedTopic0 as `0x${string}`];
      }
    } else if (computedTopic0) {
      topicsArray = [computedTopic0 as `0x${string}`];
    }

    // Resolve block numbers
    const currentBlock = await client.getBlockNumber();
    const fromBlock = input.fromBlock === 'earliest' ? 0n : BigInt(input.fromBlock);
    const toBlock = input.toBlock === 'latest' ? currentBlock : BigInt(input.toBlock);

    // Block range limit check
    const MAX_BLOCK_RANGE = 10000n;
    if (toBlock - fromBlock > MAX_BLOCK_RANGE) {
      throw new ToolError(
        'read_events',
        'BLOCK_RANGE_TOO_LARGE',
        `Block range too large (${toBlock - fromBlock}). Maximum is ${MAX_BLOCK_RANGE}. Use smaller ranges or implement pagination.`,
        { fromBlock: fromBlock.toString(), toBlock: toBlock.toString() }
      );
    }

    // Fetch logs
    const logs = await client.getLogs({
      address: normalizedAddress,
      fromBlock,
      toBlock
    });

    // Parse and decode logs
    const events = logs.map((log) => {
      const event: z.infer<typeof EventLogSchema> = {
        blockNumber: log.blockNumber!.toString(),
        blockHash: log.blockHash!,
        transactionHash: log.transactionHash!,
        transactionIndex: log.transactionIndex!,
        logIndex: log.logIndex!,
        address: getAddress(log.address),
        topics: log.topics,
        data: log.data
      };

      // Attempt to decode if ABI provided
      if (eventAbi) {
        try {
          const decoded = decodeEventLog({
            abi: [eventAbi],
            data: log.data,
            topics: log.topics
          }) as { eventName: string; args: unknown };

          event.decoded = {
            eventName: decoded.eventName,
            args: decoded.args as Record<string, any>
          };
        } catch (_error) {
          // Decoding failed - leave as raw
        }
      }

      return event;
    });

    return {
      events,
      count: events.length,
      fromBlock: fromBlock.toString(),
      toBlock: toBlock.toString()
    };
  } catch (error) {
    if (error instanceof ToolError) {
      throw error;
    }
    throw new ToolError(
      'read_events',
      'RPC_ERROR',
      `Failed to read events from ${input.address}`,
      { error: (error as Error).message }
    );
  }
}

// ============================================================================
// Tool Registration Helper
// ============================================================================

/**
 * Helper type for tool handlers
 */
export interface ToolHandler<TInput, TOutput> {
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  handler: (input: TInput) => Promise<TOutput>;
}

/**
 * Export all reading tools
 */
export const readingTools = {
  read_source: {
    inputSchema: ReadSourceInputSchema,
    outputSchema: ReadSourceOutputSchema,
    handler: readSource
  },
  read_storage: {
    inputSchema: ReadStorageInputSchema,
    outputSchema: ReadStorageOutputSchema,
    handler: readStorage
  },
  read_bytecode: {
    inputSchema: ReadBytecodeInputSchema,
    outputSchema: ReadBytecodeOutputSchema,
    handler: readBytecode
  },
  read_events: {
    inputSchema: ReadEventsInputSchema,
    outputSchema: ReadEventsOutputSchema,
    handler: readEvents
  }
};

// ============================================================================
// McpServer Tool Registration
// ============================================================================

/**
 * Register all reading tools with the McpServer
 */
export function registerReadingTools(server: McpServer) {
  // read_source
  server.registerTool(
    "read_source",
    {
      title: "Read Source",
      description: "Read Solidity source code files from the v4-core repository. Returns content, line count, size, and metadata.",
      inputSchema: {
        path: z.string().describe("Relative path from lib/v4-core/src/ (e.g., 'PoolManager.sol', 'libraries/Pool.sol')")
      }
    },
    async ({ path: inputPath }) => {
      try {
        const result = await readSource({ path: inputPath });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          structuredContent: result
        };
      } catch (error) {
        if (error instanceof ToolError) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: error.message, code: error.code, details: error.details }) }],
            isError: true
          };
        }
        throw error;
      }
    }
  );

  // read_storage
  server.registerTool(
    "read_storage",
    {
      title: "Read Storage",
      description: "Read persistent storage slots from deployed contracts. Provides raw value and best-effort decoded interpretation. Note: Only reads persistent storage, not transient storage (TLOAD/TSTORE).",
      inputSchema: {
        address: z.string().describe("Contract address"),
        slot: z.string().describe("Storage slot as hex (e.g., '0x0', '0x1')"),
        blockTag: z.union([z.literal("latest"), z.literal("earliest"), z.literal("pending"), z.number(), z.string()]).optional().describe("Block tag: 'latest', 'earliest', 'pending', block number, or block hash"),
        rpc: z.string().url().optional().describe("RPC URL (defaults to http://localhost:8545)")
      }
    },
    async (args) => {
      try {
        const result = await readStorage(args as ReadStorageInput);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          structuredContent: result
        };
      } catch (error) {
        if (error instanceof ToolError) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: error.message, code: error.code, details: error.details }) }],
            isError: true
          };
        }
        throw error;
      }
    }
  );

  // read_bytecode
  server.registerTool(
    "read_bytecode",
    {
      title: "Read Bytecode",
      description: "Retrieve deployed bytecode from a contract address. Returns bytecode, size, hash, and isEmpty flag.",
      inputSchema: {
        address: z.string().describe("Contract address (checksummed or lowercase)"),
        blockTag: z.union([z.literal("latest"), z.literal("earliest"), z.literal("pending"), z.number(), z.string()]).optional().describe("Block tag: 'latest', 'earliest', 'pending', block number, or block hash"),
        rpc: z.string().url().optional().describe("RPC URL (defaults to http://localhost:8545)")
      }
    },
    async (args) => {
      try {
        const result = await readBytecode(args as ReadBytecodeInput);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          structuredContent: result
        };
      } catch (error) {
        if (error instanceof ToolError) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: error.message, code: error.code, details: error.details }) }],
            isError: true
          };
        }
        throw error;
      }
    }
  );

  // read_events
  server.registerTool(
    "read_events",
    {
      title: "Read Events",
      description: "Query and decode event logs from the blockchain. Supports event signature parsing and block range filtering. Limited to 10k block ranges.",
      inputSchema: {
        address: z.string().describe("Contract address to query events from"),
        eventSignature: z.string().optional().describe("Event signature (e.g., 'Transfer(address,address,uint256)')"),
        topics: z.array(z.string()).optional().describe("Indexed topics to filter (topic0 is event signature hash)"),
        fromBlock: z.union([z.number(), z.literal("earliest")]).optional().describe("Starting block number"),
        toBlock: z.union([z.number(), z.literal("latest")]).optional().describe("Ending block number"),
        rpc: z.string().url().optional().describe("RPC URL (defaults to http://localhost:8545)")
      }
    },
    async (args) => {
      try {
        const result = await readEvents(args as ReadEventsInput);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          structuredContent: result
        };
      } catch (error) {
        if (error instanceof ToolError) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: error.message, code: error.code, details: error.details }) }],
            isError: true
          };
        }
        throw error;
      }
    }
  );
}