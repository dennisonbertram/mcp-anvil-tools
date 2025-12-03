/**
 * Tests for Tracing Tools
 *
 * These tests verify the trace_transaction and trace_call tools work correctly
 * with different tracer types and configurations using mocked RPC responses.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolError } from '../utils/errors.js';

// Mock viem module BEFORE importing the modules that use it
// Note: Can't reference variables from outside the factory due to hoisting
vi.mock('viem', () => {
  const mockRequest = vi.fn();
  const mockHttp = vi.fn();
  const mockCreatePublicClient = vi.fn(() => ({
    request: mockRequest
  }));

  return {
    createPublicClient: mockCreatePublicClient,
    http: mockHttp,
    // Export mocks so we can access them in tests
    __mockRequest: mockRequest,
    __mockHttp: mockHttp,
    __mockCreatePublicClient: mockCreatePublicClient
  };
});

// Import after mocking
import { traceTransaction, traceCall } from './tracing.js';
import type { TraceTransactionInput, TraceCallInput } from './tracing.js';
import * as viem from 'viem';

// Get references to mocks
const mockRequest = (viem as any).__mockRequest;
const mockHttp = (viem as any).__mockHttp;

describe('Tracing Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('trace_transaction', () => {
    describe('Input Validation', () => {
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

      it('should validate txHash format - must be 64 hex chars', async () => {
        const input = {
          txHash: '0x1234' // Too short
        } as TraceTransactionInput;

        await expect(traceTransaction(input)).rejects.toThrow();
      });
    });

    describe('Successful Traces', () => {
      it('should trace transaction with default tracer (opcode trace)', async () => {
        const mockTraceResult = {
          gas: 21000,
          failed: false,
          returnValue: '0x',
          structLogs: [
            { pc: 0, op: 'PUSH1', gas: 21000, gasCost: 3, depth: 1 },
            { pc: 2, op: 'PUSH1', gas: 20997, gasCost: 3, depth: 1 }
          ]
        };

        mockRequest.mockResolvedValueOnce(mockTraceResult);

        const input: TraceTransactionInput = {
          txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
        };

        const result = await traceTransaction(input);

        expect(result).toEqual({
          result: mockTraceResult,
          txHash: input.txHash
        });

        expect(mockRequest).toHaveBeenCalledWith({
          method: 'debug_traceTransaction',
          params: [input.txHash, {}]
        });
      });

      it('should trace transaction with callTracer', async () => {
        const mockTraceResult = {
          type: 'CALL',
          from: '0x1234567890123456789012345678901234567890',
          to: '0x9876543210987654321098765432109876543210',
          value: '0x0',
          gas: '0x5208',
          gasUsed: '0x5208',
          input: '0x',
          output: '0x'
        };

        mockRequest.mockResolvedValueOnce(mockTraceResult);

        const input: TraceTransactionInput = {
          txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          tracer: 'callTracer'
        };

        const result = await traceTransaction(input);

        expect(result).toEqual({
          result: mockTraceResult,
          txHash: input.txHash
        });

        expect(mockRequest).toHaveBeenCalledWith({
          method: 'debug_traceTransaction',
          params: [input.txHash, { tracer: 'callTracer' }]
        });
      });

      it('should trace transaction with prestateTracer', async () => {
        const mockTraceResult = {
          '0x1234567890123456789012345678901234567890': {
            balance: '0xde0b6b3a7640000',
            nonce: 1
          },
          '0x9876543210987654321098765432109876543210': {
            balance: '0x0',
            code: '0x608060405234801561001057600080fd5b50',
            nonce: 1
          }
        };

        mockRequest.mockResolvedValueOnce(mockTraceResult);

        const input: TraceTransactionInput = {
          txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          tracer: 'prestateTracer'
        };

        const result = await traceTransaction(input);

        expect(result).toEqual({
          result: mockTraceResult,
          txHash: input.txHash
        });

        expect(mockRequest).toHaveBeenCalledWith({
          method: 'debug_traceTransaction',
          params: [input.txHash, { tracer: 'prestateTracer' }]
        });
      });

      it('should trace transaction with 4byteTracer', async () => {
        const mockTraceResult = {
          '0xa9059cbb': 2, // transfer(address,uint256)
          '0x23b872dd': 1  // transferFrom(address,address,uint256)
        };

        mockRequest.mockResolvedValueOnce(mockTraceResult);

        const input: TraceTransactionInput = {
          txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          tracer: '4byteTracer'
        };

        const result = await traceTransaction(input);

        expect(result).toEqual({
          result: mockTraceResult,
          txHash: input.txHash
        });

        expect(mockRequest).toHaveBeenCalledWith({
          method: 'debug_traceTransaction',
          params: [input.txHash, { tracer: '4byteTracer' }]
        });
      });

      it('should trace transaction with tracerConfig', async () => {
        const mockTraceResult = {
          type: 'CALL',
          from: '0x1234567890123456789012345678901234567890',
          to: '0x9876543210987654321098765432109876543210',
          value: '0x0',
          gas: '0x5208',
          gasUsed: '0x5208',
          input: '0x',
          output: '0x'
        };

        mockRequest.mockResolvedValueOnce(mockTraceResult);

        const input: TraceTransactionInput = {
          txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          tracer: 'callTracer',
          tracerConfig: { onlyTopCall: true }
        };

        const result = await traceTransaction(input);

        expect(result).toEqual({
          result: mockTraceResult,
          txHash: input.txHash
        });

        expect(mockRequest).toHaveBeenCalledWith({
          method: 'debug_traceTransaction',
          params: [input.txHash, { tracer: 'callTracer', tracerConfig: { onlyTopCall: true } }]
        });
      });

      it('should use default RPC URL when not provided', async () => {
        const mockTraceResult = { gas: 21000, failed: false, returnValue: '0x' };
        mockRequest.mockResolvedValueOnce(mockTraceResult);

        const input: TraceTransactionInput = {
          txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
        };

        await traceTransaction(input);

        // Verify http was called with default URL
        expect(mockHttp).toHaveBeenCalledWith('http://localhost:8545', expect.any(Object));
      });

      it('should use custom RPC URL when provided', async () => {
        const mockTraceResult = { gas: 21000, failed: false, returnValue: '0x' };
        mockRequest.mockResolvedValueOnce(mockTraceResult);

        const input: TraceTransactionInput = {
          txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          rpc: 'http://custom-rpc.example.com:8545'
        };

        await traceTransaction(input);

        // Verify http was called with custom URL
        expect(mockHttp).toHaveBeenCalledWith('http://custom-rpc.example.com:8545', expect.any(Object));
      });
    });

    describe('Error Handling', () => {
      it('should throw ToolError when RPC request fails', async () => {
        mockRequest.mockRejectedValue(new Error('Transaction not found'));

        const input: TraceTransactionInput = {
          txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
        };

        await expect(traceTransaction(input)).rejects.toThrow(ToolError);
        await expect(traceTransaction(input)).rejects.toThrow(/Failed to trace transaction/);
      });

      it('should include transaction hash in error details', async () => {
        mockRequest.mockRejectedValueOnce(new Error('Network error'));

        const input: TraceTransactionInput = {
          txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
        };

        try {
          await traceTransaction(input);
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ToolError);
          expect((error as ToolError).details).toMatchObject({
            txHash: input.txHash
          });
        }
      });
    });
  });

  describe('trace_call', () => {
    describe('Input Validation', () => {
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

      it('should validate to address format - must be 40 hex chars', async () => {
        const input = {
          to: '0x1234', // Too short
          data: '0x'
        } as TraceCallInput;

        await expect(traceCall(input)).rejects.toThrow();
      });
    });

    describe('Successful Traces', () => {
      it('should trace call with minimal parameters', async () => {
        const mockTraceResult = {
          gas: 21000,
          failed: false,
          returnValue: '0x0000000000000000000000000000000000000000000000000000000000000001',
          structLogs: []
        };

        mockRequest.mockResolvedValueOnce(mockTraceResult);

        const input: TraceCallInput = {
          to: '0x1234567890123456789012345678901234567890',
          data: '0x'
        };

        const result = await traceCall(input);

        expect(result).toEqual({
          result: mockTraceResult
        });

        expect(mockRequest).toHaveBeenCalledWith({
          method: 'debug_traceCall',
          params: [
            { to: input.to, data: input.data },
            'latest',
            {}
          ]
        });
      });

      it('should trace call with from parameter', async () => {
        const mockTraceResult = { gas: 21000, failed: false, returnValue: '0x' };
        mockRequest.mockResolvedValueOnce(mockTraceResult);

        const input: TraceCallInput = {
          to: '0x1234567890123456789012345678901234567890',
          data: '0x',
          from: '0x9876543210987654321098765432109876543210'
        };

        const result = await traceCall(input);

        expect(result).toEqual({ result: mockTraceResult });

        expect(mockRequest).toHaveBeenCalledWith({
          method: 'debug_traceCall',
          params: [
            { to: input.to, data: input.data, from: input.from },
            'latest',
            {}
          ]
        });
      });

      it('should trace call with value parameter', async () => {
        const mockTraceResult = { gas: 21000, failed: false, returnValue: '0x' };
        mockRequest.mockResolvedValueOnce(mockTraceResult);

        const input: TraceCallInput = {
          to: '0x1234567890123456789012345678901234567890',
          data: '0x',
          value: '0xde0b6b3a7640000' // 1 ETH in wei
        };

        const result = await traceCall(input);

        expect(result).toEqual({ result: mockTraceResult });

        expect(mockRequest).toHaveBeenCalledWith({
          method: 'debug_traceCall',
          params: [
            { to: input.to, data: input.data, value: input.value },
            'latest',
            {}
          ]
        });
      });

      it('should trace call with blockTag parameter', async () => {
        const mockTraceResult = { gas: 21000, failed: false, returnValue: '0x' };
        mockRequest.mockResolvedValueOnce(mockTraceResult);

        const input: TraceCallInput = {
          to: '0x1234567890123456789012345678901234567890',
          data: '0x',
          blockTag: 'pending'
        };

        const result = await traceCall(input);

        expect(result).toEqual({ result: mockTraceResult });

        expect(mockRequest).toHaveBeenCalledWith({
          method: 'debug_traceCall',
          params: [
            { to: input.to, data: input.data },
            'pending',
            {}
          ]
        });
      });

      it('should trace call with callTracer', async () => {
        const mockTraceResult = {
          type: 'CALL',
          from: '0x9876543210987654321098765432109876543210',
          to: '0x1234567890123456789012345678901234567890',
          value: '0x0',
          gas: '0x5208',
          gasUsed: '0x5208',
          input: '0xa9059cbb',
          output: '0x0000000000000000000000000000000000000000000000000000000000000001',
          calls: []
        };

        mockRequest.mockResolvedValueOnce(mockTraceResult);

        const input: TraceCallInput = {
          to: '0x1234567890123456789012345678901234567890',
          data: '0xa9059cbb',
          tracer: 'callTracer'
        };

        const result = await traceCall(input);

        expect(result).toEqual({ result: mockTraceResult });

        expect(mockRequest).toHaveBeenCalledWith({
          method: 'debug_traceCall',
          params: [
            { to: input.to, data: input.data },
            'latest',
            { tracer: 'callTracer' }
          ]
        });
      });

      it('should trace call with tracerConfig', async () => {
        const mockTraceResult = {
          type: 'CALL',
          from: '0x9876543210987654321098765432109876543210',
          to: '0x1234567890123456789012345678901234567890',
          value: '0x0',
          gas: '0x5208',
          gasUsed: '0x5208',
          input: '0x',
          output: '0x'
        };

        mockRequest.mockResolvedValueOnce(mockTraceResult);

        const input: TraceCallInput = {
          to: '0x1234567890123456789012345678901234567890',
          data: '0x',
          tracer: 'callTracer',
          tracerConfig: { onlyTopCall: true }
        };

        const result = await traceCall(input);

        expect(result).toEqual({ result: mockTraceResult });

        expect(mockRequest).toHaveBeenCalledWith({
          method: 'debug_traceCall',
          params: [
            { to: input.to, data: input.data },
            'latest',
            { tracer: 'callTracer', tracerConfig: { onlyTopCall: true } }
          ]
        });
      });

      it('should use default RPC URL when not provided', async () => {
        const mockTraceResult = { gas: 21000, failed: false, returnValue: '0x' };
        mockRequest.mockResolvedValueOnce(mockTraceResult);

        const input: TraceCallInput = {
          to: '0x1234567890123456789012345678901234567890',
          data: '0x'
        };

        await traceCall(input);

        // Verify http was called with default URL
        expect(mockHttp).toHaveBeenCalledWith('http://localhost:8545', expect.any(Object));
      });

      it('should use custom RPC URL when provided', async () => {
        const mockTraceResult = { gas: 21000, failed: false, returnValue: '0x' };
        mockRequest.mockResolvedValueOnce(mockTraceResult);

        const input: TraceCallInput = {
          to: '0x1234567890123456789012345678901234567890',
          data: '0x',
          rpc: 'http://custom-rpc.example.com:8545'
        };

        await traceCall(input);

        // Verify http was called with custom URL
        expect(mockHttp).toHaveBeenCalledWith('http://custom-rpc.example.com:8545', expect.any(Object));
      });

      it('should trace call with all optional parameters', async () => {
        const mockTraceResult = {
          type: 'CALL',
          from: '0xabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd',
          to: '0x1234567890123456789012345678901234567890',
          value: '0xde0b6b3a7640000',
          gas: '0x5208',
          gasUsed: '0x5208',
          input: '0xa9059cbb',
          output: '0x0000000000000000000000000000000000000000000000000000000000000001'
        };

        mockRequest.mockResolvedValueOnce(mockTraceResult);

        const input: TraceCallInput = {
          to: '0x1234567890123456789012345678901234567890',
          data: '0xa9059cbb',
          from: '0xabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd',
          value: '0xde0b6b3a7640000',
          blockTag: 'latest',
          tracer: 'callTracer',
          tracerConfig: { onlyTopCall: true }
        };

        const result = await traceCall(input);

        expect(result).toEqual({ result: mockTraceResult });

        expect(mockRequest).toHaveBeenCalledWith({
          method: 'debug_traceCall',
          params: [
            {
              to: input.to,
              data: input.data,
              from: input.from,
              value: input.value
            },
            'latest',
            { tracer: 'callTracer', tracerConfig: { onlyTopCall: true } }
          ]
        });
      });
    });

    describe('Error Handling', () => {
      it('should throw ToolError when RPC request fails', async () => {
        mockRequest.mockRejectedValue(new Error('Execution reverted'));

        const input: TraceCallInput = {
          to: '0x1234567890123456789012345678901234567890',
          data: '0x'
        };

        await expect(traceCall(input)).rejects.toThrow(ToolError);
        await expect(traceCall(input)).rejects.toThrow(/Failed to trace call/);
      });

      it('should include contract address in error details', async () => {
        mockRequest.mockRejectedValueOnce(new Error('Invalid opcode'));

        const input: TraceCallInput = {
          to: '0x1234567890123456789012345678901234567890',
          data: '0x'
        };

        try {
          await traceCall(input);
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ToolError);
          expect((error as ToolError).details).toMatchObject({
            to: input.to
          });
        }
      });
    });
  });
});
