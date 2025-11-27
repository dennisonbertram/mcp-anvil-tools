import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv(); // Load .env file

const ConfigSchema = z.object({
  // Server
  port: z.coerce.number().default(3000),
  host: z.string().default("0.0.0.0"),

  // Database
  dbPath: z.string().default("./audit-mcp.db"),

  // Anvil
  anvilPortStart: z.coerce.number().default(8545),
  anvilPortEnd: z.coerce.number().default(8555),
  anvilDefaultChainId: z.coerce.number().default(31337),

  // API Keys
  etherscanApiKey: z.string().optional(),
  arbiscanApiKey: z.string().optional(),

  // RPC URLs (required for non-Anvil networks)
  mainnetRpcUrl: z.string().optional(),
  sepoliaRpcUrl: z.string().optional(),

  // Logging
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  logFile: z.string().default("./audit-mcp.log"),

  // Tools
  slitherPath: z.string().default("slither"),
  solcPath: z.string().default("solc"),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  return ConfigSchema.parse({
    port: process.env.AUDIT_MCP_PORT,
    host: process.env.AUDIT_MCP_HOST,
    dbPath: process.env.AUDIT_MCP_DB_PATH,
    anvilPortStart: process.env.ANVIL_PORT_START,
    anvilPortEnd: process.env.ANVIL_PORT_END,
    anvilDefaultChainId: process.env.ANVIL_DEFAULT_CHAIN_ID,
    etherscanApiKey: process.env.ETHERSCAN_API_KEY,
    arbiscanApiKey: process.env.ARBISCAN_API_KEY,
    mainnetRpcUrl: process.env.MAINNET_RPC_URL,
    sepoliaRpcUrl: process.env.SEPOLIA_RPC_URL,
    logLevel: process.env.LOG_LEVEL,
    logFile: process.env.LOG_FILE,
    slitherPath: process.env.SLITHER_PATH,
    solcPath: process.env.SOLC_PATH,
  });
}

// Singleton
let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

// Network RPC URL helper
export function getRpcUrl(network: string): string {
  const cfg = getConfig();

  switch (network.toLowerCase()) {
    case "mainnet":
      if (!cfg.mainnetRpcUrl) {
        throw new Error("MAINNET_RPC_URL environment variable is required for mainnet access");
      }
      return cfg.mainnetRpcUrl;
    case "sepolia":
      if (!cfg.sepoliaRpcUrl) {
        throw new Error("SEPOLIA_RPC_URL environment variable is required for sepolia access");
      }
      return cfg.sepoliaRpcUrl;
    case "anvil":
      return `http://127.0.0.1:${cfg.anvilPortStart}`;
    default:
      throw new Error(`Unknown network: ${network}. Supported: mainnet, sepolia, anvil`);
  }
}
