import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { createPublicClient, http } from "viem";
import { Config } from "../config.js";
import { getStateManager } from "../state/manager.js";
import { AnvilError } from "../utils/errors.js";
import {
  StartAnvilOptions,
  AnvilInstance,
  AnvilState,
} from "./types.js";

export class AnvilManager {
  private instances = new Map<string, AnvilInstance>();
  private portAllocator: PortAllocator;

  constructor(private config: Config) {
    this.portAllocator = new PortAllocator(
      config.anvilPortStart,
      config.anvilPortEnd
    );
  }

  async initialize() {
    // Load existing instances from database and mark as orphaned
    const stateManager = getStateManager();
    const dbInstances = await stateManager.listAnvilInstances("running");

    for (const dbInstance of dbInstances) {
      // Check if process is still running
      const isRunning =
        dbInstance.pid && this.checkProcessRunning(dbInstance.pid);

      if (!isRunning) {
        // Mark as orphaned - process existed but we can't control it
        await stateManager.updateAnvilStatus(
          dbInstance.id,
          "orphaned",
          new Date().toISOString()
        );
        console.warn(
          `Anvil instance ${dbInstance.id} marked as orphaned (PID ${dbInstance.pid} not running)`
        );
      } else {
        // Mark as orphaned even if running - we don't have process control
        await stateManager.updateAnvilStatus(
          dbInstance.id,
          "orphaned",
          new Date().toISOString()
        );
        console.warn(
          `Anvil instance ${dbInstance.id} marked as orphaned (cannot reattach to PID ${dbInstance.pid})`
        );
      }
    }

    console.log(`Checked ${dbInstances.length} previous Anvil instances`);
  }

  async start(options: StartAnvilOptions = {}): Promise<AnvilInstance> {
    const id = randomUUID();
    const port = options.port || (await this.portAllocator.allocate());

    if (!port) {
      throw new AnvilError("No available ports for Anvil instance");
    }

    const args = [
      "--port",
      port.toString(),
      "--chain-id",
      (options.chainId || this.config.anvilDefaultChainId).toString(),
    ];

    if (options.forkUrl) {
      args.push("--fork-url", options.forkUrl);
      if (options.forkBlockNumber) {
        args.push("--fork-block-number", options.forkBlockNumber.toString());
      }
    }

    const process = spawn("anvil", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const instance: AnvilInstance = {
      id,
      port,
      status: "starting",
      process,
      forkedFrom: options.forkUrl,
      chainId: options.chainId || this.config.anvilDefaultChainId,
      startedAt: new Date().toISOString(),
      pid: process.pid,
    };

    this.instances.set(id, instance);

    // Handle process output
    process.stdout?.on("data", (data) => {
      const output = data.toString();

      // Redact private keys from Anvil output
      const redactedOutput = output.replace(
        /0x[a-fA-F0-9]{64}/g,
        "0x[REDACTED]"
      );
      console.debug(`[Anvil ${id}] ${redactedOutput}`);

      // Detect successful start
      if (output.includes("Listening on")) {
        instance.status = "running";
        console.info(`Anvil instance ${id} started on port ${port}`);
      }
    });

    process.stderr?.on("data", (data) => {
      console.error(`[Anvil ${id}] ${data.toString()}`);
    });

    process.on("exit", (code) => {
      console.info(`Anvil instance ${id} exited with code ${code}`);
      instance.status = "stopped";
      this.portAllocator.release(port);

      // Update database
      const stateManager = getStateManager();
      stateManager
        .updateAnvilStatus(id, "stopped", new Date().toISOString())
        .catch((err) => console.error("Failed to update Anvil status:", err));
    });

    // Save to database
    const stateManager = getStateManager();
    await stateManager.saveAnvilInstance({
      id,
      port,
      status: "starting",
      forkedFrom: options.forkUrl,
      chainId: options.chainId || this.config.anvilDefaultChainId,
      startedAt: instance.startedAt,
      pid: process.pid,
    });

    // Wait for startup with RPC check
    await this.waitForStartup(instance, port);

    return instance;
  }

  async stop(id: string): Promise<void> {
    const instance = this.instances.get(id);
    if (!instance) {
      throw new AnvilError(`Anvil instance not found: ${id}`);
    }

    if (instance.process) {
      instance.process.kill("SIGTERM");
    }

    instance.status = "stopped";

    // Update database
    const stateManager = getStateManager();
    await stateManager.updateAnvilStatus(
      id,
      "stopped",
      new Date().toISOString()
    );

    console.info(`Stopped Anvil instance ${id}`);
  }

  async stopAll(): Promise<void> {
    for (const [id, instance] of this.instances.entries()) {
      // Only stop instances we have process control over
      if (instance.process && instance.status !== "orphaned") {
        await this.stop(id);
      } else {
        console.warn(`Skipping stop for instance ${id} (no process control)`);
      }
    }
  }

  getInstance(id: string): AnvilInstance | undefined {
    return this.instances.get(id);
  }

  listInstances(): AnvilInstance[] {
    return Array.from(this.instances.values());
  }

  async getState(id: string): Promise<AnvilState> {
    const instance = this.getInstance(id);
    if (!instance) {
      throw new AnvilError(`Anvil instance not found: ${id}`);
    }

    const rpcUrl = `http://127.0.0.1:${instance.port}`;
    const client = createPublicClient({
      transport: http(rpcUrl),
    });

    try {
      const blockNumber = await client.getBlockNumber();
      const chainId = await client.getChainId();

      return {
        chainId,
        blockNumber: Number(blockNumber),
        accounts: [],
        recentLogs: [],
      };
    } catch (error) {
      throw new AnvilError(
        `Failed to get state for Anvil instance ${id}: ${(error as Error).message}`
      );
    }
  }

  private async waitForStartup(
    instance: AnvilInstance,
    port: number,
    timeout = 10000
  ): Promise<void> {
    const startTime = Date.now();
    const rpcUrl = `http://127.0.0.1:${port}`;

    // Poll RPC endpoint until it responds
    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_blockNumber",
            params: [],
            id: 1,
          }),
        });

        if (response.ok) {
          const data = await response.json() as { result?: unknown };
          if (data.result !== undefined) {
            instance.status = "running";
            console.info(
              `Anvil instance ${instance.id} RPC ready on port ${port}`
            );
            return;
          }
        }
      } catch (e) {
        // Not ready yet, continue polling
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new AnvilError(
      `Anvil instance ${instance.id} failed to start within ${timeout}ms`
    );
  }

  private checkProcessRunning(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }
}

class PortAllocator {
  private available: Set<number>;
  private allocated: Set<number>;

  constructor(start: number, end: number) {
    this.available = new Set();
    this.allocated = new Set();

    for (let port = start; port <= end; port++) {
      this.available.add(port);
    }
  }

  async allocate(): Promise<number | null> {
    // Try to find an available port that's not in use
    for (const port of this.available) {
      if (await this.isPortFree(port)) {
        this.available.delete(port);
        this.allocated.add(port);
        return port;
      }
    }
    return null;
  }

  private async isPortFree(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const net = require("net");
      const tester = net
        .createServer()
        .once("error", () => resolve(false))
        .once("listening", () => {
          tester.close();
          resolve(true);
        })
        .listen(port, "127.0.0.1");
    });
  }

  release(port: number): void {
    this.allocated.delete(port);
    this.available.add(port);
  }

  reserve(port: number): void {
    this.available.delete(port);
    this.allocated.add(port);
  }
}
