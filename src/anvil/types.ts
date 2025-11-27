import { ChildProcess } from "child_process";

export interface StartAnvilOptions {
  forkUrl?: string;
  forkBlockNumber?: number;
  chainId?: number;
  port?: number;
}

export interface AnvilInstance {
  id: string;
  port: number;
  status: "starting" | "running" | "stopped" | "orphaned" | "error";
  process: ChildProcess | null;
  forkedFrom?: string;
  chainId?: number;
  startedAt: string;
  pid?: number;
}

export interface AnvilState {
  chainId: number;
  blockNumber: number;
  accounts: string[];
  recentLogs: string[];
}

export interface AnvilInstanceInfo {
  id: string;
  port: number;
  status: "starting" | "running" | "stopped" | "orphaned" | "error";
  forkedFrom?: string;
  chainId?: number;
  startedAt: string;
  stoppedAt?: string;
  pid?: number;
}
