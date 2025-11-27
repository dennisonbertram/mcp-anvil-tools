#!/usr/bin/env node
/**
 * Test script for MCP server tools
 *
 * Prerequisites:
 * 1. Start Anvil: anvil --port 8545
 * 2. Build the MCP server: npm run build
 * 3. Run this test: npx tsx test-tools.ts
 */

import { readSource, readStorage, readBytecode, readEvents } from './dist/tools/reading.js';
import { simulateTx, sendTx, impersonate, createSnapshot, revertSnapshot } from './dist/tools/execution.js';
import { createPublicClient, http, parseEther } from 'viem';

const RPC_URL = 'http://127.0.0.1:8545';
const ANVIL_ACCOUNT_0 = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const ANVIL_ACCOUNT_1 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

// ANSI color codes for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message: string, type: 'success' | 'error' | 'info' | 'test' = 'info') {
  const prefix = {
    success: `${colors.green}✓${colors.reset}`,
    error: `${colors.red}✗${colors.reset}`,
    info: `${colors.blue}ℹ${colors.reset}`,
    test: `${colors.yellow}→${colors.reset}`
  }[type];
  console.log(`${prefix} ${message}`);
}

function section(title: string) {
  console.log(`\n${colors.bold}${colors.blue}═══ ${title} ═══${colors.reset}\n`);
}

async function checkAnvilRunning(): Promise<boolean> {
  try {
    const client = createPublicClient({ transport: http(RPC_URL) });
    await client.getBlockNumber();
    return true;
  } catch {
    return false;
  }
}

async function testReadSource() {
  section('Testing read_source');

  try {
    // Change to parent directory for this test
    const originalCwd = process.cwd();
    process.chdir('..');

    log('Reading PoolManager.sol...', 'test');
    const result = await readSource({ path: 'PoolManager.sol' });

    // Restore original directory
    process.chdir(originalCwd);

    if (result.content.includes('contract PoolManager')) {
      log(`Successfully read ${result.lines} lines (${result.size} bytes)`, 'success');
      log(`Path: ${result.path}`, 'info');
      return true;
    } else {
      log('File content does not contain expected contract', 'error');
      return false;
    }
  } catch (error: any) {
    log(`Error: ${error.message}`, 'error');
    return false;
  }
}

async function testReadStorage() {
  section('Testing read_storage');

  try {
    // First, deploy a simple contract with storage
    log('Deploying a simple contract with storage...', 'test');

    // SimpleStorage contract: stores a uint256 at slot 0
    // constructor sets it to 42
    const bytecode = '0x6080604052602a600055348015601457600080fd5b5060358060226000396000f3fe6080604052600080fdfea164736f6c6343000826000a';

    const deployResult = await sendTx({
      data: bytecode,
      rpc: RPC_URL
    });

    if (!deployResult.contractAddress) {
      log('Failed to deploy contract', 'error');
      return false;
    }

    log(`Contract deployed at ${deployResult.contractAddress}`, 'info');

    // Now read storage slot 0
    log('Reading storage slot 0...', 'test');
    const result = await readStorage({
      address: deployResult.contractAddress,
      slot: '0x0',
      rpc: RPC_URL
    });

    log(`Storage value: ${result.value}`, 'info');
    if (result.decoded) {
      log(`Decoded as ${result.decoded.type}: ${result.decoded.value}`, 'info');
    }

    // Check if the value is 42 (0x2a)
    // The decoded value might be interpreted as an address since it has leading zeros
    // So we check the raw value
    const decimalValue = BigInt(result.value).toString();
    if (decimalValue === '42') {
      log('Storage value matches expected (42)', 'success');
      return true;
    } else {
      log(`Storage value mismatch. Expected 42, got ${decimalValue}`, 'error');
      return false;
    }
  } catch (error: any) {
    log(`Error: ${error.message}`, 'error');
    return false;
  }
}

async function testReadBytecode() {
  section('Testing read_bytecode');

  try {
    // First deploy a simple contract from read_storage test
    log('Deploying a simple contract...', 'test');
    // This bytecode works (from read_storage test)
    const bytecode = '0x6080604052602a600055348015601457600080fd5b5060358060226000396000f3fe6080604052600080fdfea164736f6c6343000826000a';

    const deployResult = await sendTx({
      data: bytecode,
      rpc: RPC_URL
    });

    if (!deployResult.contractAddress || deployResult.status !== 'success') {
      log(`Failed to deploy contract: ${deployResult.revertReason || 'unknown error'}`, 'error');
      log(`Status: ${deployResult.status}`, 'error');
      return false;
    }

    log(`Contract deployed at ${deployResult.contractAddress}`, 'info');

    // Read bytecode
    log('Reading contract bytecode...', 'test');
    const result = await readBytecode({
      address: deployResult.contractAddress,
      rpc: RPC_URL
    });

    log(`Bytecode size: ${result.size} bytes`, 'info');
    log(`Code hash: ${result.codeHash}`, 'info');
    log(`Is empty: ${result.isEmpty}`, 'info');

    if (!result.isEmpty && result.size > 0 && result.bytecode.startsWith('0x')) {
      log('Successfully read bytecode', 'success');
      return true;
    } else {
      log('Bytecode read failed or empty', 'error');
      return false;
    }
  } catch (error: any) {
    log(`Error: ${error.message}`, 'error');
    return false;
  }
}

async function testReadEvents() {
  section('Testing read_events');

  try {
    // For this test, we'll just query a contract (may be empty)
    log('Querying events from a contract...', 'test');

    const result = await readEvents({
      address: ANVIL_ACCOUNT_0, // Query from an EOA (will have no events)
      fromBlock: 0,
      toBlock: 100,
      rpc: RPC_URL
    });

    log(`Found ${result.count} events`, 'info');
    log(`Block range: ${result.fromBlock} to ${result.toBlock}`, 'info');

    // Success if we get a valid response (even if empty)
    if (result.count >= 0 && result.events.length === result.count) {
      log('Successfully queried events (empty result is valid)', 'success');
      return true;
    } else {
      log('Events query returned invalid data', 'error');
      return false;
    }
  } catch (error: any) {
    log(`Error: ${error.message}`, 'error');
    return false;
  }
}

async function testSimulateTx() {
  section('Testing simulate_tx');

  try {
    log('Simulating an ETH transfer...', 'test');

    // Simulate without value to avoid balance issues
    const result = await simulateTx({
      to: ANVIL_ACCOUNT_1,
      data: '0x',
      from: ANVIL_ACCOUNT_0,
      rpc: RPC_URL
    });

    log(`Result: ${result.result}`, 'info');
    log(`Reverted: ${result.reverted}`, 'info');

    if (!result.reverted) {
      log('Simulation succeeded', 'success');
      return true;
    } else {
      log(`Simulation reverted: ${result.revertReason}`, 'error');
      return false;
    }
  } catch (error: any) {
    log(`Error: ${error.message}`, 'error');
    return false;
  }
}

async function testSendTx() {
  section('Testing send_tx');

  try {
    log('Sending an ETH transfer...', 'test');

    const result = await sendTx({
      to: ANVIL_ACCOUNT_1,
      data: '0x',
      value: '0x' + parseEther('0.1').toString(16),
      rpc: RPC_URL
    });

    log(`Transaction hash: ${result.txHash}`, 'info');
    log(`Block number: ${result.blockNumber}`, 'info');
    log(`Gas used: ${result.gasUsed}`, 'info');
    log(`Status: ${result.status}`, 'info');

    if (result.status === 'success') {
      log('Transaction succeeded', 'success');
      return true;
    } else {
      log(`Transaction failed: ${result.revertReason}`, 'error');
      return false;
    }
  } catch (error: any) {
    log(`Error: ${error.message}`, 'error');
    return false;
  }
}

async function testImpersonate() {
  section('Testing impersonate');

  try {
    log('Impersonating an address...', 'test');

    const testAddress = '0x0000000000000000000000000000000000000001';

    // Start impersonation
    const result = await impersonate({
      address: testAddress,
      rpc: RPC_URL
    });

    log(`Address: ${result.address}`, 'info');
    log(`Active: ${result.active}`, 'info');
    log(`Balance: ${result.balance || '0'}`, 'info');

    if (result.success && result.active) {
      log('Impersonation activated', 'success');

      // Stop impersonation
      log('Stopping impersonation...', 'test');
      const stopResult = await impersonate({
        address: testAddress,
        stopImpersonating: true,
        rpc: RPC_URL
      });

      if (stopResult.success && !stopResult.active) {
        log('Impersonation stopped', 'success');
        return true;
      } else {
        log('Failed to stop impersonation', 'error');
        return false;
      }
    } else {
      log('Impersonation failed', 'error');
      return false;
    }
  } catch (error: any) {
    log(`Error: ${error.message}`, 'error');
    return false;
  }
}

async function testCreateSnapshot() {
  section('Testing create_snapshot');

  try {
    log('Creating a snapshot...', 'test');

    const result = await createSnapshot({
      name: 'test-snapshot',
      description: 'Test snapshot for MCP server',
      rpc: RPC_URL
    });

    log(`Snapshot ID: ${result.snapshotId}`, 'info');
    log(`Name: ${result.name}`, 'info');
    log(`Block number: ${result.blockNumber}`, 'info');
    log(`Block hash: ${result.blockHash}`, 'info');

    if (result.snapshotId && result.blockNumber >= 0) {
      log('Snapshot created successfully', 'success');
      return result.snapshotId;
    } else {
      log('Snapshot creation failed', 'error');
      return null;
    }
  } catch (error: any) {
    log(`Error: ${error.message}`, 'error');
    return null;
  }
}

async function testRevertSnapshot(snapshotId: string) {
  section('Testing revert_snapshot');

  try {
    // Make some state changes
    log('Making state changes...', 'test');
    await sendTx({
      to: ANVIL_ACCOUNT_1,
      data: '0x',
      value: '0x' + parseEther('0.01').toString(16),
      rpc: RPC_URL
    });

    // Revert to snapshot
    log('Reverting to snapshot...', 'test');
    const result = await revertSnapshot({
      snapshotId,
      rpc: RPC_URL
    });

    log(`Snapshot ID: ${result.snapshotId}`, 'info');
    log(`Block number: ${result.blockNumber}`, 'info');
    log(`Success: ${result.success}`, 'info');
    log(`Reverted: ${result.reverted}`, 'info');

    if (result.success && result.reverted) {
      log('Successfully reverted to snapshot', 'success');
      return true;
    } else {
      log('Revert failed', 'error');
      return false;
    }
  } catch (error: any) {
    log(`Error: ${error.message}`, 'error');
    return false;
  }
}

async function main() {
  console.log(`${colors.bold}${colors.blue}MCP Server Tools Test Suite${colors.reset}\n`);

  // Check if Anvil is running
  log('Checking if Anvil is running...', 'test');
  const anvilRunning = await checkAnvilRunning();

  if (!anvilRunning) {
    log('Anvil is not running at http://127.0.0.1:8545', 'error');
    log('Please start Anvil with: anvil --port 8545', 'info');
    process.exit(1);
  }

  log('Anvil is running', 'success');

  const results: Record<string, boolean> = {};

  // Test reading tools
  results['read_source'] = await testReadSource();
  results['read_storage'] = await testReadStorage();
  results['read_bytecode'] = await testReadBytecode();
  results['read_events'] = await testReadEvents();

  // Test execution tools
  results['simulate_tx'] = await testSimulateTx();
  results['send_tx'] = await testSendTx();
  results['impersonate'] = await testImpersonate();

  // Test snapshot tools (these are interdependent)
  const snapshotId = await testCreateSnapshot();
  if (snapshotId) {
    results['create_snapshot'] = true;
    results['revert_snapshot'] = await testRevertSnapshot(snapshotId);
  } else {
    results['create_snapshot'] = false;
    results['revert_snapshot'] = false;
  }

  // Summary
  section('Test Results Summary');
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  Object.entries(results).forEach(([tool, success]) => {
    log(`${tool}: ${success ? 'PASS' : 'FAIL'}`, success ? 'success' : 'error');
  });

  console.log();
  if (passed === total) {
    log(`All tests passed! (${passed}/${total})`, 'success');
    process.exit(0);
  } else {
    log(`Some tests failed. (${passed}/${total} passed)`, 'error');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
