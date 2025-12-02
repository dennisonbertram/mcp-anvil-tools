/**
 * Tests for execution tools error handling and response structure
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { simulateTx, SimulateTxInput } from './execution.js';

// Mock viem to control RPC behavior
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    createPublicClient: vi.fn(),
  };
});

import { createPublicClient } from 'viem';

describe('simulateTx', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Anvil connection errors', () => {
    it('should return a clear error message when Anvil is not running', async () => {
      // Mock a connection refused error (ECONNREFUSED)
      const mockClient = {
        request: vi.fn().mockRejectedValue(
          Object.assign(new Error('fetch failed'), {
            cause: { code: 'ECONNREFUSED' }
          })
        ),
      };

      vi.mocked(createPublicClient).mockReturnValue(mockClient as any);

      const input: SimulateTxInput = {
        to: '0x1234567890123456789012345678901234567890',
        data: '0x',
      };

      // Should throw with a helpful message mentioning Anvil
      await expect(simulateTx(input)).rejects.toThrow(/anvil/i);
    });

    it('should mention checking if Anvil is running on connection timeout', async () => {
      // Mock a timeout error
      const mockClient = {
        request: vi.fn().mockRejectedValue(
          Object.assign(new Error('The request took too long'), {
            name: 'TimeoutError'
          })
        ),
      };

      vi.mocked(createPublicClient).mockReturnValue(mockClient as any);

      const input: SimulateTxInput = {
        to: '0x1234567890123456789012345678901234567890',
        data: '0x',
      };

      await expect(simulateTx(input)).rejects.toThrow(/anvil|running|connection/i);
    });
  });

  describe('Revert response structure', () => {
    it('should not include result field when transaction reverts', async () => {
      // Mock successful chain ID request
      const mockClient = {
        request: vi.fn().mockResolvedValue('0x7a69'), // Chain ID for anvil
        call: vi.fn().mockRejectedValue(
          Object.assign(new Error('Execution reverted'), {
            name: 'CallExecutionError',
            shortMessage: 'Execution reverted',
            data: '0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000f5472616e73666572206661696c65640000000000000000000000000000000000'
          })
        ),
      };

      vi.mocked(createPublicClient).mockReturnValue(mockClient as any);

      const input: SimulateTxInput = {
        to: '0x1234567890123456789012345678901234567890',
        data: '0x',
      };

      const result = await simulateTx(input);

      // result field should be undefined, not '0x'
      expect(result.result).toBeUndefined();
      expect(result.reverted).toBe(true);
    });

    it('should have a clean revertReason without full error stack', async () => {
      const mockClient = {
        request: vi.fn().mockResolvedValue('0x7a69'),
        call: vi.fn().mockRejectedValue(
          Object.assign(new Error('CallExecutionError: HTTP request failed.\n\nStatus: 0\nURL: http://127.0.0.1:8545\nRequest body: {...}'), {
            name: 'CallExecutionError',
            shortMessage: 'Execution reverted: invalid jump destination',
          })
        ),
      };

      vi.mocked(createPublicClient).mockReturnValue(mockClient as any);

      const input: SimulateTxInput = {
        to: '0x1234567890123456789012345678901234567890',
        data: '0xbadcode',
      };

      const result = await simulateTx(input);

      expect(result.reverted).toBe(true);
      // revertReason should be concise, not contain HTTP details or stack traces
      expect(result.revertReason).not.toContain('HTTP request failed');
      expect(result.revertReason).not.toContain('Request body');
      // Should just contain the actual reason
      expect(result.revertReason).toMatch(/invalid jump destination|Execution reverted/);
    });

    it('should not include redundant error field when revertReason is present', async () => {
      const mockClient = {
        request: vi.fn().mockResolvedValue('0x7a69'),
        call: vi.fn().mockRejectedValue(
          Object.assign(new Error('Execution reverted'), {
            name: 'CallExecutionError',
            shortMessage: 'Execution reverted: custom error',
          })
        ),
      };

      vi.mocked(createPublicClient).mockReturnValue(mockClient as any);

      const input: SimulateTxInput = {
        to: '0x1234567890123456789012345678901234567890',
        data: '0x',
      };

      const result = await simulateTx(input);

      expect(result.reverted).toBe(true);
      expect(result.revertReason).toBeDefined();
      // error field should not duplicate the revert reason info
      expect(result.error).toBeUndefined();
    });
  });
});
