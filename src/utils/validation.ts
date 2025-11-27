import { z } from "zod";

/**
 * Zod validation schemas for common input types
 */

export const EthereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");

export const HexStringSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]+$/, "Invalid hex string");

export const BlockNumberSchema = z.union([
  z.string().regex(/^0x[a-fA-F0-9]+$/),
  z.literal("latest"),
  z.literal("earliest"),
  z.literal("pending"),
]);

export const NetworkSchema = z.enum(["mainnet", "sepolia", "anvil"]);
