/**
 * Execution Tools for MCP Smart Contract Auditing Server
 *
 * Provides transaction simulation, execution, state manipulation, and encoding/decoding
 * capabilities for Anvil and testnet environments.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  decodeErrorResult,
  decodeFunctionResult,
  type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { z } from 'zod';

// ============================================================================
// Shared Client Factory with Connection Pooling
// ============================================================================

const clientCache = new Map<string, PublicClient>();

function getClient(rpcUrl: string, _chainId?: number): PublicClient {
  const key = `${rpcUrl}:${_chainId || 'auto'}`;
  if (!clientCache.has(key)) {
    clientCache.set(key, createPublicClient({
      transport: http(rpcUrl),
    }) as PublicClient);
  }
  return clientCache.get(key)!;
}

/**
 * Check if RPC is Anvil by attempting to call anvil_nodeInfo
 */
async function checkIsAnvil(client: PublicClient): Promise<boolean> {
  try {
    await client.request({ method: 'anvil_nodeInfo' as any, params: [] as any });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if an error is a connection error (Anvil not running, network issue, etc.)
 * and return a user-friendly error message
 */
function isConnectionError(error: unknown): string | null {
  if (!(error instanceof Error)) return null;

  const errorMessage = error.message.toLowerCase();
  const cause = (error as Error & { cause?: { code?: string } }).cause;

  // Check for common connection error patterns
  if (
    cause?.code === 'ECONNREFUSED' ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('fetch failed') ||
    errorMessage.includes('connection refused')
  ) {
    return 'Cannot connect to RPC endpoint. Is Anvil running? Start it with: anvil';
  }

  if (
    errorMessage.includes('timeout') ||
    errorMessage.includes('timed out') ||
    error.name === 'TimeoutError'
  ) {
    return 'RPC connection timed out. Check if Anvil is running and the RPC URL is correct.';
  }

  if (
    errorMessage.includes('network') ||
    errorMessage.includes('socket')
  ) {
    return 'Network error connecting to RPC. Verify Anvil is running on the expected port.';
  }

  return null;
}

// ============================================================================
// Snapshot Registry (shared across create/revert)
// ============================================================================

interface SnapshotMetadata {
  snapshotId: string;
  name?: string;
  blockNumber: number;
  blockHash: string;
  timestamp: number;
  created: number;
}

const snapshots = new Map<string, SnapshotMetadata>();
const consumedSnapshots = new Set<string>();

// ============================================================================
// Impersonation Tracking
// ============================================================================

const impersonatedAddresses = new Set<string>();

// ============================================================================
// 1. SIMULATE_TX - Simulate transaction without sending
// ============================================================================

const StateOverrideSchema = z.object({
  balance: z.string().optional().describe("Override account balance (hex wei)"),
  nonce: z.string().optional().describe("Override account nonce (hex or decimal string)"),
  code: z.string().regex(/^0x[a-fA-F0-9]*$/).optional().describe("Override account code (hex)"),
  state: z.record(
    z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    z.string().regex(/^0x[a-fA-F0-9]{64}$/)
  ).optional().describe("Override storage slots {32-byte slot: 32-byte value}"),
  stateDiff: z.record(
    z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    z.string().regex(/^0x[a-fA-F0-9]{64}$/)
  ).optional().describe("Storage diffs {32-byte slot: 32-byte value}")
});

export const SimulateTxInputSchema = z.object({
  to: z.string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .describe("Target contract address"),
  data: z.string()
    .regex(/^0x[a-fA-F0-9]*$/)
    .describe("Calldata (hex encoded)"),
  from: z.string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional()
    .describe("Sender address (defaults to first unlocked Anvil account)"),
  gasLimit: z.string()
    .optional()
    .describe("Gas limit (hex or decimal string) to prevent infinite loops"),
  abi: z.array(z.any())
    .optional()
    .describe("Contract ABI for decoding return data"),
  functionName: z.string()
    .optional()
    .describe("Function name for decoding (requires abi)"),
  value: z.string()
    .regex(/^0x[a-fA-F0-9]+$/)
    .optional()
    .describe("ETH value in wei (hex)"),
  blockNumber: z.union([
    z.string().regex(/^0x[a-fA-F0-9]+$/),
    z.enum(["latest", "earliest", "pending", "safe", "finalized"])
  ]).optional().describe("Block number to simulate at"),
  stateOverrides: z.record(StateOverrideSchema)
    .optional()
    .describe("State overrides by address"),
  rpc: z.string().url().optional().describe("RPC endpoint (defaults to local Anvil)")
});

export const SimulateTxOutputSchema = z.object({
  result: z.string().optional().describe("Return data (hex encoded) - only present on success"),
  decoded: z.any().optional().describe("Decoded return value if ABI provided"),
  gasUsed: z.string().optional().describe("Gas consumed (hex) - only available with tracing"),
  logs: z.array(z.object({
    address: z.string().describe("Contract that emitted log"),
    topics: z.array(z.string()).describe("Indexed event parameters"),
    data: z.string().describe("Non-indexed event data")
  })).optional().describe("Event logs (only available with tracing)"),
  reverted: z.boolean().describe("Whether call reverted"),
  revertReason: z.string().optional().describe("Decoded revert reason - concise message without stack traces"),
  revertData: z.string().optional().describe("Raw revert data (hex)")
});

export type SimulateTxInput = z.infer<typeof SimulateTxInputSchema>;
export type SimulateTxOutput = z.infer<typeof SimulateTxOutputSchema>;

export async function simulateTx(input: SimulateTxInput): Promise<SimulateTxOutput> {
  const rpcUrl = input.rpc || 'http://127.0.0.1:8545';

  // Detect chain ID from RPC (DO NOT hardcode)
  const tempClient = createPublicClient({ transport: http(rpcUrl) });
  let chainId: string;
  try {
    chainId = await tempClient.request({ method: 'eth_chainId' });
  } catch (error) {
    // Check for connection errors and provide helpful message
    const connectionError = isConnectionError(error);
    if (connectionError) {
      throw new Error(connectionError);
    }
    throw error;
  }

  // Get or create cached client
  const client = getClient(rpcUrl, Number(chainId));

  try {
    // Default from address to first Anvil account, NOT zero address
    let fromAddress = input.from;
    if (!fromAddress) {
      const accounts = await client.request({ method: 'eth_accounts' as any, params: [] as any }) as string[];
      fromAddress = (accounts && accounts[0]) || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
    }

    // Prepare call parameters with gas limit to prevent infinite loops
    const callParams: any = {
      to: input.to as `0x${string}`,
      data: input.data as `0x${string}`,
      from: fromAddress as `0x${string}`,
      ...(input.value && { value: BigInt(input.value) }),
      ...(input.gasLimit && { gas: BigInt(input.gasLimit) })
    };

    // Execute eth_call with state overrides
    const result = await client.call({
      ...callParams,
      blockNumber: input.blockNumber ?
        (input.blockNumber.startsWith('0x') ? BigInt(input.blockNumber) : input.blockNumber as any) :
        undefined,
      stateOverride: input.stateOverrides as any
    });

    // Decode result if ABI provided
    let decoded;
    if (input.abi && input.functionName && result.data) {
      try {
        decoded = decodeFunctionResult({
          abi: input.abi,
          functionName: input.functionName,
          data: result.data
        });
      } catch (e) {
        // Decoding failed, return undefined
      }
    }

    return {
      result: result.data || '0x',
      decoded,
      reverted: false
    };

  } catch (error: any) {
    // Check for connection errors first
    const connectionError = isConnectionError(error);
    if (connectionError) {
      throw new Error(connectionError);
    }

    // Handle revert - decode revert data from error
    if (error.name === 'CallExecutionError' || error.name === 'ContractFunctionRevertedError') {
      let revertReason: string | undefined;
      let revertData: string | undefined;

      // Extract revert data from error.data or error.cause.data
      const data = error.data || error.cause?.data;
      if (data && input.abi) {
        try {
          const decoded = decodeErrorResult({
            abi: input.abi,
            data
          });
          revertReason = `${decoded.errorName}(${JSON.stringify(decoded.args)})`;
          revertData = data;
        } catch (e) {
          // Decoding failed, use short message (clean, no stack traces)
          revertReason = error.shortMessage || 'Execution reverted';
          revertData = data;
        }
      } else {
        // Use shortMessage which is concise, not the full error.message with HTTP details
        revertReason = error.shortMessage || 'Execution reverted';
        revertData = data;
      }

      // Clean response: no result field on revert, no redundant error field
      return {
        reverted: true,
        revertReason,
        revertData,
      };
    }

    throw error;
  }
}

// ============================================================================
// 2. SEND_TX - Send actual transaction
// ============================================================================

export const SendTxInputSchema = z.object({
  to: z.string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional()
    .describe("Target address (omit for contract deployment)"),
  data: z.string()
    .regex(/^0x[a-fA-F0-9]*$/)
    .describe("Transaction data / contract bytecode"),
  from: z.string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional()
    .describe("Sender address (defaults to Anvil account 0)"),
  value: z.string()
    .regex(/^0x[a-fA-F0-9]+$/)
    .optional()
    .default("0x0")
    .describe("ETH value in wei (hex or decimal string)"),
  gasLimit: z.string()
    .optional()
    .describe("Gas limit (hex or decimal string, auto-estimated if not provided)"),
  gasPrice: z.string()
    .optional()
    .describe("Legacy gas price in wei (hex or decimal string)"),
  maxFeePerGas: z.string()
    .optional()
    .describe("EIP-1559 max fee per gas (hex or decimal string)"),
  maxPriorityFeePerGas: z.string()
    .optional()
    .describe("EIP-1559 priority fee per gas (hex or decimal string)"),
  nonce: z.string()
    .optional()
    .describe("Transaction nonce (hex or decimal string, auto-determined if not provided)"),
  privateKey: z.string()
    .optional()
    .describe("Private key for signing (uses Anvil unlocked accounts if not provided)"),
  confirmations: z.number()
    .optional()
    .default(1)
    .describe("Number of confirmations to wait for"),
  rpc: z.string().url().optional().describe("RPC endpoint")
});

export const SendTxOutputSchema = z.object({
  txHash: z.string().describe("Transaction hash"),
  blockNumber: z.string().describe("Block number where tx was mined (as string)"),
  blockHash: z.string().describe("Block hash"),
  gasUsed: z.string().describe("Actual gas consumed (as string)"),
  effectiveGasPrice: z.string().describe("Actual gas price paid (as string)"),
  status: z.enum(["success", "reverted"]).describe("Transaction status"),
  logs: z.array(z.object({
    address: z.string(),
    topics: z.array(z.string()),
    data: z.string(),
    logIndex: z.number(),
    transactionIndex: z.number()
  })).describe("Event logs"),
  contractAddress: z.string()
    .optional()
    .describe("Deployed contract address (if deployment)"),
  revertReason: z.string().optional().describe("Decoded revert reason if failed"),
  revertData: z.string().optional().describe("Raw revert data if failed"),
  from: z.string().describe("Sender address"),
  to: z.string().optional().describe("Recipient address")
});

export type SendTxInput = z.infer<typeof SendTxInputSchema>;
export type SendTxOutput = z.infer<typeof SendTxOutputSchema>;

export async function sendTx(input: SendTxInput): Promise<SendTxOutput> {
  const rpcUrl = input.rpc || 'http://127.0.0.1:8545';

  // Detect chain ID from RPC (DO NOT hardcode foundry chain)
  const tempClient = createPublicClient({ transport: http(rpcUrl) });
  const chainId = await tempClient.request({ method: 'eth_chainId' });
  const chainIdNum = Number(chainId);

  const publicClient = getClient(rpcUrl, chainIdNum);

  // Determine account and signing method
  let account: any;
  let useImpersonation = false;

  if (input.privateKey) {
    // Sign with private key - use detected chainId for EIP-155
    account = privateKeyToAccount(input.privateKey as `0x${string}`);
  } else if (input.from) {
    // Use unlocked account (only works on Anvil)
    // Validate we're on Anvil before attempting impersonation
    const isAnvil = await checkIsAnvil(publicClient);
    if (!isAnvil) {
      throw new Error('Cannot use from without privateKey on non-Anvil RPC. Provide privateKey or use Anvil.');
    }

    // Impersonate the address
    await publicClient.request({
      method: 'anvil_impersonateAccount' as any,
      params: [input.from as `0x${string}`] as any
    });
    account = input.from as `0x${string}`;
    useImpersonation = true;
  } else {
    // Use first unlocked account (Anvil account 0)
    const accounts = await publicClient.request({
      method: 'eth_accounts' as any,
      params: [] as any
    }) as string[];
    account = (accounts && accounts[0]) || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  }

  const walletClient = createWalletClient({
    account: typeof account === 'string' ? account as `0x${string}` : account,
    chain: {
      id: chainIdNum,
      name: `Chain ${chainIdNum}`,
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: [rpcUrl] },
        public: { http: [rpcUrl] }
      }
    } as any,
    transport: http(rpcUrl)
  }) as any;

  // Prepare transaction with BigInt for all numeric values
  const txRequest: any = {
    data: input.data as `0x${string}`,
    ...(input.to && { to: input.to as `0x${string}` }),
    ...(input.value && { value: BigInt(input.value) }),
    ...(input.gasLimit && { gas: BigInt(input.gasLimit) }),
    // Support both legacy and EIP-1559 fee fields
    ...(input.gasPrice && { gasPrice: BigInt(input.gasPrice) }),
    ...(input.maxFeePerGas && { maxFeePerGas: BigInt(input.maxFeePerGas) }),
    ...(input.maxPriorityFeePerGas && { maxPriorityFeePerGas: BigInt(input.maxPriorityFeePerGas) }),
    ...(input.nonce !== undefined && { nonce: Number(input.nonce) })
  };

  // Send transaction
  const hash = await walletClient.sendTransaction(txRequest);

  // Wait for receipt with configurable confirmations
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: input.confirmations || 1
  });

  // Stop impersonation if we started it
  if (useImpersonation && input.from) {
    await publicClient.request({
      method: 'anvil_stopImpersonatingAccount' as any,
      params: [input.from as `0x${string}`] as any
    });
  }

  // If transaction reverted, try to get revert reason
  let revertReason: string | undefined;
  let revertData: string | undefined;

  if (receipt.status === 'reverted') {
    // Attempt to get revert reason via eth_call simulation
    try {
      await publicClient.call({
        to: input.to as `0x${string}`,
        data: input.data as `0x${string}`,
        blockNumber: receipt.blockNumber - 1n
      });
    } catch (error: any) {
      const data = error.data || error.cause?.data;
      if (data) {
        revertData = data;
        revertReason = error.shortMessage || 'Transaction reverted';
      }
    }
  }

  return {
    txHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber.toString(),
    blockHash: receipt.blockHash,
    gasUsed: receipt.gasUsed.toString(),
    effectiveGasPrice: receipt.effectiveGasPrice.toString(),
    status: receipt.status === 'success' ? 'success' : 'reverted',
    logs: receipt.logs.map(log => ({
      address: log.address,
      topics: log.topics,
      data: log.data,
      logIndex: log.logIndex || 0,
      transactionIndex: log.transactionIndex || 0
    })),
    contractAddress: receipt.contractAddress || undefined,
    revertReason,
    revertData,
    from: receipt.from,
    to: receipt.to || undefined
  };
}

// ============================================================================
// 3. IMPERSONATE - Impersonate any address (Anvil only)
// ============================================================================

export const ImpersonateInputSchema = z.object({
  address: z.string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .describe("Address to impersonate"),
  stopImpersonating: z.boolean()
    .optional()
    .default(false)
    .describe("Stop impersonating this address"),
  rpc: z.string().url().optional().describe("RPC endpoint (must be Anvil)")
});

export const ImpersonateOutputSchema = z.object({
  success: z.boolean().describe("Whether impersonation succeeded"),
  address: z.string().describe("Address being impersonated"),
  active: z.boolean().describe("Whether impersonation is currently active"),
  balance: z.string().optional().describe("Current balance of impersonated address")
});

export type ImpersonateInput = z.infer<typeof ImpersonateInputSchema>;
export type ImpersonateOutput = z.infer<typeof ImpersonateOutputSchema>;

export async function impersonate(input: ImpersonateInput): Promise<ImpersonateOutput> {
  const rpcUrl = input.rpc || 'http://127.0.0.1:8545';
  const client = createPublicClient({
    transport: http(rpcUrl)
  });

  // CRITICAL: Validate RPC is Anvil before attempting impersonation
  const isAnvil = await checkIsAnvil(client);
  if (!isAnvil) {
    throw new Error(
      'Impersonation only works on Anvil. Current RPC does not support anvil_impersonateAccount. ' +
      'Use a local Anvil instance or provide a private key for signing.'
    );
  }

  try {
    if (input.stopImpersonating) {
      // Stop impersonating
      await client.request({
        method: 'anvil_stopImpersonatingAccount' as any,
        params: [input.address as `0x${string}`] as any
      });

      impersonatedAddresses.delete(input.address.toLowerCase());

      return {
        success: true,
        address: input.address,
        active: false
      };
    } else {
      // Check if already impersonating
      if (impersonatedAddresses.has(input.address.toLowerCase())) {
        console.warn(`Already impersonating ${input.address}`);
      }

      // Start impersonating
      await client.request({
        method: 'anvil_impersonateAccount' as any,
        params: [input.address as `0x${string}`] as any
      });

      impersonatedAddresses.add(input.address.toLowerCase());

      // Get balance and optionally warn if insufficient
      const balance = await client.getBalance({
        address: input.address as `0x${string}`
      });

      if (balance === 0n) {
        console.warn(
          `Warning: Impersonated address ${input.address} has zero balance. ` +
          `Consider using anvil_setBalance to fund it.`
        );
      }

      return {
        success: true,
        address: input.address,
        active: true,
        balance: `0x${balance.toString(16)}`
      };
    }
  } catch (error: any) {
    throw new Error(`Impersonation failed: ${error.message}`);
  }
}

// ============================================================================
// 4. CREATE_SNAPSHOT - Create Anvil state snapshot
// ============================================================================

export const CreateSnapshotInputSchema = z.object({
  name: z.string()
    .optional()
    .describe("Human-readable snapshot identifier"),
  description: z.string()
    .optional()
    .describe("Description of snapshot state"),
  rpc: z.string().url().optional().describe("RPC endpoint (must be Anvil)")
});

export const CreateSnapshotOutputSchema = z.object({
  snapshotId: z.string().describe("Unique snapshot identifier"),
  name: z.string().optional().describe("Human-readable name"),
  blockNumber: z.number().describe("Block number at snapshot"),
  blockHash: z.string().describe("Block hash at snapshot"),
  timestamp: z.number().describe("Block timestamp"),
  created: z.number().describe("Unix timestamp when snapshot was created")
});

export type CreateSnapshotInput = z.infer<typeof CreateSnapshotInputSchema>;
export type CreateSnapshotOutput = z.infer<typeof CreateSnapshotOutputSchema>;

export async function createSnapshot(
  input: CreateSnapshotInput
): Promise<CreateSnapshotOutput> {
  const rpcUrl = input.rpc || 'http://127.0.0.1:8545';
  const client = createPublicClient({
    transport: http(rpcUrl)
  });

  // Try evm_snapshot first (standard), fallback to anvil_snapshot
  let snapshotId: string;
  try {
    snapshotId = await client.request({
      method: 'evm_snapshot' as any,
      params: [] as any
    }) as any;
  } catch {
    // Fallback to anvil_snapshot
    snapshotId = await client.request({
      method: 'anvil_snapshot' as any,
      params: [] as any
    }) as any;
  }

  // Get current block info
  const block = await client.getBlock({ blockTag: 'latest' });

  const snapshot: CreateSnapshotOutput = {
    snapshotId,
    name: input.name,
    blockNumber: Number(block.number),
    blockHash: block.hash!,
    timestamp: Number(block.timestamp),
    created: Date.now()
  };

  // Enforce unique snapshot names
  if (input.name) {
    if (snapshots.has(input.name)) {
      throw new Error(`Snapshot name "${input.name}" already exists. Use a unique name.`);
    }
    snapshots.set(input.name, snapshot);
  }
  snapshots.set(snapshotId, snapshot);

  console.log(`Snapshot created: ${input.name || snapshotId} at block ${snapshot.blockNumber}`);
  console.warn('Snapshots are lost on node restart. Use anvil_dumpState for persistent backups.');

  return snapshot;
}

// ============================================================================
// 5. REVERT_SNAPSHOT - Revert to snapshot
// ============================================================================

export const RevertSnapshotInputSchema = z.object({
  snapshotId: z.string().describe("Snapshot ID or name to revert to"),
  rpc: z.string().url().optional().describe("RPC endpoint (must be Anvil)")
});

export const RevertSnapshotOutputSchema = z.object({
  success: z.boolean().describe("Whether revert succeeded"),
  snapshotId: z.string().describe("ID that was reverted to"),
  blockNumber: z.number().describe("Block number after revert"),
  blockHash: z.string().describe("Block hash after revert"),
  timestamp: z.number().describe("Block timestamp after revert"),
  reverted: z.boolean().describe("Whether state was actually reverted")
});

export type RevertSnapshotInput = z.infer<typeof RevertSnapshotInputSchema>;
export type RevertSnapshotOutput = z.infer<typeof RevertSnapshotOutputSchema>;

export async function revertSnapshot(
  input: RevertSnapshotInput
): Promise<RevertSnapshotOutput> {
  const rpcUrl = input.rpc || 'http://127.0.0.1:8545';
  const client = createPublicClient({
    transport: http(rpcUrl)
  });

  // Resolve snapshot ID (might be a name)
  let snapshotId = input.snapshotId;
  const stored = snapshots.get(input.snapshotId);
  if (stored) {
    snapshotId = stored.snapshotId;
  }

  // Check if already consumed (many providers invalidate after revert)
  if (consumedSnapshots.has(snapshotId)) {
    console.warn(`Snapshot ${snapshotId} was already reverted. Some providers invalidate snapshot IDs after use.`);
  }

  // Validate snapshot exists
  if (!snapshots.has(snapshotId)) {
    throw new Error(`Snapshot not found: ${input.snapshotId}. Create a snapshot first.`);
  }

  // Try evm_revert first (standard), fallback to anvil_revert
  let reverted: boolean;
  try {
    reverted = await client.request({
      method: 'evm_revert' as any,
      params: [snapshotId] as any
    }) as any;
  } catch {
    // Fallback to anvil_revert
    reverted = await client.request({
      method: 'anvil_revert' as any,
      params: [snapshotId] as any
    }) as any;
  }

  // Mark as consumed (snapshot IDs are typically single-use)
  consumedSnapshots.add(snapshotId);

  // Get new block state
  const block = await client.getBlock({ blockTag: 'latest' });

  const snapshotName = stored?.name || snapshotId;
  console.log(`Reverted to snapshot: ${snapshotName} (block ${block.number})`);

  return {
    success: reverted,
    snapshotId,
    blockNumber: Number(block.number),
    blockHash: block.hash!,
    timestamp: Number(block.timestamp),
    reverted
  };
}

// ============================================================================
// Export All Schemas and Types
// ============================================================================

export const executionToolSchemas = {
  simulateTx: { input: SimulateTxInputSchema, output: SimulateTxOutputSchema },
  sendTx: { input: SendTxInputSchema, output: SendTxOutputSchema },
  impersonate: { input: ImpersonateInputSchema, output: ImpersonateOutputSchema },
  createSnapshot: { input: CreateSnapshotInputSchema, output: CreateSnapshotOutputSchema },
  revertSnapshot: { input: RevertSnapshotInputSchema, output: RevertSnapshotOutputSchema },
};

export const executionTools = {
  simulateTx,
  sendTx,
  impersonate,
  createSnapshot,
  revertSnapshot,
};
