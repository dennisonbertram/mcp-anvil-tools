/**
 * Tests for config module - Alchemy RPC URL generation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We need to test the module with different env vars, so we'll mock them
describe("config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getAlchemyRpcUrl", () => {
    it("should generate Alchemy URL with provided network slug", async () => {
      process.env.ALCHEMY_API_KEY = "test-api-key";
      const { getAlchemyRpcUrl } = await import("./config.js");

      const url = getAlchemyRpcUrl("eth-mainnet");
      expect(url).toBe("https://eth-mainnet.g.alchemy.com/v2/test-api-key");
    });

    it("should accept any network slug without validation", async () => {
      process.env.ALCHEMY_API_KEY = "test-api-key";
      const { getAlchemyRpcUrl } = await import("./config.js");

      // Should work with any slug - Alchemy will error if invalid
      const url = getAlchemyRpcUrl("arb-mainnet");
      expect(url).toBe("https://arb-mainnet.g.alchemy.com/v2/test-api-key");
    });

    it("should work with polygon network slug", async () => {
      process.env.ALCHEMY_API_KEY = "test-api-key";
      const { getAlchemyRpcUrl } = await import("./config.js");

      const url = getAlchemyRpcUrl("polygon-mainnet");
      expect(url).toBe("https://polygon-mainnet.g.alchemy.com/v2/test-api-key");
    });

    it("should work with base network slug", async () => {
      process.env.ALCHEMY_API_KEY = "test-api-key";
      const { getAlchemyRpcUrl } = await import("./config.js");

      const url = getAlchemyRpcUrl("base-mainnet");
      expect(url).toBe("https://base-mainnet.g.alchemy.com/v2/test-api-key");
    });

    it("should work with optimism network slug", async () => {
      process.env.ALCHEMY_API_KEY = "test-api-key";
      const { getAlchemyRpcUrl } = await import("./config.js");

      const url = getAlchemyRpcUrl("opt-mainnet");
      expect(url).toBe("https://opt-mainnet.g.alchemy.com/v2/test-api-key");
    });

    it("should work with any future network slug", async () => {
      process.env.ALCHEMY_API_KEY = "test-api-key";
      const { getAlchemyRpcUrl } = await import("./config.js");

      // Future networks should work without code changes
      const url = getAlchemyRpcUrl("some-future-network");
      expect(url).toBe("https://some-future-network.g.alchemy.com/v2/test-api-key");
    });

    it("should throw error when ALCHEMY_API_KEY is not set", async () => {
      delete process.env.ALCHEMY_API_KEY;
      const { getAlchemyRpcUrl } = await import("./config.js");

      expect(() => getAlchemyRpcUrl("eth-mainnet")).toThrow(
        "ALCHEMY_API_KEY environment variable is required"
      );
    });

    it("should throw error for empty network slug", async () => {
      process.env.ALCHEMY_API_KEY = "test-api-key";
      const { getAlchemyRpcUrl } = await import("./config.js");

      expect(() => getAlchemyRpcUrl("")).toThrow(
        "Network slug is required"
      );
    });

    it("should lowercase the network slug", async () => {
      process.env.ALCHEMY_API_KEY = "test-api-key";
      const { getAlchemyRpcUrl } = await import("./config.js");

      expect(getAlchemyRpcUrl("ETH-MAINNET")).toBe(
        "https://eth-mainnet.g.alchemy.com/v2/test-api-key"
      );
    });
  });

  describe("getRpcUrl with Alchemy fallback", () => {
    it("should use explicit RPC URL when provided for mainnet", async () => {
      process.env.MAINNET_RPC_URL = "https://custom-rpc.example.com";
      const { getRpcUrl } = await import("./config.js");

      const url = getRpcUrl("mainnet");
      expect(url).toBe("https://custom-rpc.example.com");
    });

    it("should fall back to Alchemy for mainnet when no explicit RPC URL", async () => {
      delete process.env.MAINNET_RPC_URL;
      process.env.ALCHEMY_API_KEY = "test-api-key";
      const { getRpcUrl } = await import("./config.js");

      const url = getRpcUrl("mainnet");
      expect(url).toBe("https://eth-mainnet.g.alchemy.com/v2/test-api-key");
    });

    it("should fall back to Alchemy for sepolia when no explicit RPC URL", async () => {
      delete process.env.SEPOLIA_RPC_URL;
      process.env.ALCHEMY_API_KEY = "test-api-key";
      const { getRpcUrl } = await import("./config.js");

      const url = getRpcUrl("sepolia");
      expect(url).toBe("https://eth-sepolia.g.alchemy.com/v2/test-api-key");
    });

    it("should still return anvil URL for anvil network", async () => {
      process.env.ALCHEMY_API_KEY = "test-api-key";
      const { getRpcUrl } = await import("./config.js");

      const url = getRpcUrl("anvil");
      expect(url).toContain("127.0.0.1");
    });

    it("should throw error when no RPC URL configured and no Alchemy key for mainnet", async () => {
      delete process.env.MAINNET_RPC_URL;
      delete process.env.ALCHEMY_API_KEY;
      const { getRpcUrl } = await import("./config.js");

      expect(() => getRpcUrl("mainnet")).toThrow();
    });

    it("should throw error for unknown network when no Alchemy key", async () => {
      delete process.env.ALCHEMY_API_KEY;
      const { getRpcUrl } = await import("./config.js");

      expect(() => getRpcUrl("unknown-network")).toThrow();
    });
  });

  describe("config schema includes alchemyApiKey", () => {
    it("should include alchemyApiKey in loaded config", async () => {
      process.env.ALCHEMY_API_KEY = "test-api-key";
      const { loadConfig } = await import("./config.js");

      const config = loadConfig();
      expect(config.alchemyApiKey).toBe("test-api-key");
    });

    it("should allow alchemyApiKey to be optional", async () => {
      delete process.env.ALCHEMY_API_KEY;
      const { loadConfig } = await import("./config.js");

      const config = loadConfig();
      expect(config.alchemyApiKey).toBeUndefined();
    });
  });
});
