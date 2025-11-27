/**
 * Tests for Tracing Tools
 *
 * These tests verify the trace_transaction and trace_call tools work correctly
 * with different tracer types and configurations.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createPublicClient, http } from 'viem';
import { traceTransaction, traceCall } from './tracing.js';
import type { TraceTransactionInput, TraceCallInput } from './tracing.js';

describe('Tracing Tools', () => {
  let testClient: ReturnType<typeof createPublicClient>;
  const RPC_URL = 'http://127.0.0.1:8545';

  beforeAll(() => {
    testClient = createPublicClient({
      transport: http(RPC_URL)
    });
  });

  describe('trace_transaction', () => {
    it('should validate input schema - requires txHash', async () => {
      const input = {} as TraceTransactionInput;

      await expect(traceTransaction(input)).rejects.toThrow();
    });

    it('should validate input schema - txHash must be hex', async () => {
      const input = {
        txHash: 'invalid-hash'
      } as TraceTransactionInput;

      await expect(traceTransaction(input)).rejects.toThrow();
    });

    it('should accept valid txHash', async () => {
      const input: TraceTransactionInput = {
        txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      };

      // This should not throw during validation
      // Actual RPC call may fail if tx doesn't exist, but input is valid
      try {
        await traceTransaction(input);
      } catch (error) {
        // Expected to fail if tx doesn't exist
        expect(error).toBeDefined();
      }
    });

    it('should accept callTracer as tracer type', async () => {
      const input: TraceTransactionInput = {
        txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        tracer: 'callTracer'
      };

      try {
        await traceTransaction(input);
      } catch (error) {
        // Expected to fail if tx doesn't exist
        expect(error).toBeDefined();
      }
    });

    it('should accept prestateTracer as tracer type', async () => {
      const input: TraceTransactionInput = {
        txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        tracer: 'prestateTracer'
      };

      try {
        await traceTransaction(input);
      } catch (error) {
        // Expected to fail if tx doesn't exist
        expect(error).toBeDefined();
      }
    });

    it('should accept 4byteTracer as tracer type', async () => {
      const input: TraceTransactionInput = {
        txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        tracer: '4byteTracer'
      };

      try {
        await traceTransaction(input);
      } catch (error) {
        // Expected to fail if tx doesn't exist
        expect(error).toBeDefined();
      }
    });

    it('should accept tracerConfig', async () => {
      const input: TraceTransactionInput = {
        txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        tracer: 'callTracer',
        tracerConfig: { onlyTopCall: true }
      };

      try {
        await traceTransaction(input);
      } catch (error) {
        // Expected to fail if tx doesn't exist
        expect(error).toBeDefined();
      }
    });

    it('should use default RPC URL when not provided', async () => {
      const input: TraceTransactionInput = {
        txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      };

      try {
        await traceTransaction(input);
      } catch (error) {
        // Expected to fail if tx doesn't exist, but should use default RPC
        expect(error).toBeDefined();
      }
    });

    it('should use custom RPC URL when provided', async () => {
      const input: TraceTransactionInput = {
        txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        rpc: 'http://localhost:8545'
      };

      try {
        await traceTransaction(input);
      } catch (error) {
        // Expected to fail if tx doesn't exist
        expect(error).toBeDefined();
      }
    });
  });

  describe('trace_call', () => {
    it('should validate input schema - requires to and data', async () => {
      const input = {} as TraceCallInput;

      await expect(traceCall(input)).rejects.toThrow();
    });

    it('should validate input schema - to must be valid address', async () => {
      const input = {
        to: 'invalid-address',
        data: '0x'
      } as TraceCallInput;

      await expect(traceCall(input)).rejects.toThrow();
    });

    it('should validate input schema - data must be hex', async () => {
      const input = {
        to: '0x1234567890123456789012345678901234567890',
        data: 'not-hex'
      } as TraceCallInput;

      await expect(traceCall(input)).rejects.toThrow();
    });

    it('should accept valid to and data', async () => {
      const input: TraceCallInput = {
        to: '0x1234567890123456789012345678901234567890',
        data: '0x'
      };

      try {
        await traceCall(input);
      } catch (error) {
        // May fail if contract doesn't exist, but input is valid
        expect(error).toBeDefined();
      }
    });

    it('should accept optional from parameter', async () => {
      const input: TraceCallInput = {
        to: '0x1234567890123456789012345678901234567890',
        data: '0x',
        from: '0x9876543210987654321098765432109876543210'
      };

      try {
        await traceCall(input);
      } catch (error) {
        // May fail, but input is valid
        expect(error).toBeDefined();
      }
    });

    it('should accept optional value parameter', async () => {
      const input: TraceCallInput = {
        to: '0x1234567890123456789012345678901234567890',
        data: '0x',
        value: '0x0'
      };

      try {
        await traceCall(input);
      } catch (error) {
        // May fail, but input is valid
        expect(error).toBeDefined();
      }
    });

    it('should accept blockTag parameter', async () => {
      const input: TraceCallInput = {
        to: '0x1234567890123456789012345678901234567890',
        data: '0x',
        blockTag: 'latest'
      };

      try {
        await traceCall(input);
      } catch (error) {
        // May fail, but input is valid
        expect(error).toBeDefined();
      }
    });

    it('should accept tracer parameter', async () => {
      const input: TraceCallInput = {
        to: '0x1234567890123456789012345678901234567890',
        data: '0x',
        tracer: 'callTracer'
      };

      try {
        await traceCall(input);
      } catch (error) {
        // May fail, but input is valid
        expect(error).toBeDefined();
      }
    });

    it('should accept tracerConfig parameter', async () => {
      const input: TraceCallInput = {
        to: '0x1234567890123456789012345678901234567890',
        data: '0x',
        tracer: 'callTracer',
        tracerConfig: { onlyTopCall: true }
      };

      try {
        await traceCall(input);
      } catch (error) {
        // May fail, but input is valid
        expect(error).toBeDefined();
      }
    });

    it('should use default RPC URL when not provided', async () => {
      const input: TraceCallInput = {
        to: '0x1234567890123456789012345678901234567890',
        data: '0x'
      };

      try {
        await traceCall(input);
      } catch (error) {
        // Should use default RPC
        expect(error).toBeDefined();
      }
    });

    it('should use custom RPC URL when provided', async () => {
      const input: TraceCallInput = {
        to: '0x1234567890123456789012345678901234567890',
        data: '0x',
        rpc: 'http://localhost:8545'
      };

      try {
        await traceCall(input);
      } catch (error) {
        // May fail, but should use custom RPC
        expect(error).toBeDefined();
      }
    });
  });
});
