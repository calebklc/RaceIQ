import { USER_DATA_DIR } from "./paths";

/**
 * Resolves the data directory for RaceIQ.
 * Delegates to USER_DATA_DIR from paths.ts.
 */
export function resolveDataDir(): string {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  return USER_DATA_DIR;
}
