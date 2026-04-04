import { execSync } from "child_process";
import type { ServerGameAdapter } from "./types";

const adapters: ServerGameAdapter[] = [];
const adapterMap = new Map<string, ServerGameAdapter>();
/** gameId → lowercase process names, built at registration time */
const processNameMap = new Map<string, string[]>();

export function registerServerGame(adapter: ServerGameAdapter): void {
  adapters.push(adapter);
  adapterMap.set(adapter.id, adapter);
  if (adapter.processNames?.length) {
    processNameMap.set(adapter.id, adapter.processNames.map((n) => n.toLowerCase()));
  }
}

export function getServerGame(gameId: string): ServerGameAdapter {
  const adapter = adapterMap.get(gameId);
  if (!adapter) throw new Error(`Unknown server game adapter: ${gameId}`);
  return adapter;
}

export function tryGetServerGame(gameId: string): ServerGameAdapter | undefined {
  return adapterMap.get(gameId);
}

/** Get all server adapters in registration order (used for packet detection priority). */
export function getAllServerGames(): readonly ServerGameAdapter[] {
  return adapters;
}

/** Cached set of running process names (lowercase, no extension) — refreshed every 2s. */
let _processCache: { names: Set<string>; at: number } = { names: new Set(), at: 0 };

function getRunningProcesses(): Set<string> {
  if (Date.now() - _processCache.at < 2000) return _processCache.names;
  try {
    const out = execSync(
      'tasklist /FO CSV /NH',
      { encoding: "utf-8", timeout: 3000, windowsHide: true }
    );
    const names = new Set(
      out.split(/\r?\n/)
        .map((line) => line.match(/^"([^"]+)"/)?.[1]?.replace(/\.exe$/i, "").toLowerCase())
        .filter((n): n is string => !!n)
    );
    _processCache = { names, at: Date.now() };
    return names;
  } catch {
    return _processCache.names;
  }
}

/** Check if a specific game's process is running. */
export function isGameRunning(gameId: string): boolean {
  const registeredNames = processNameMap.get(gameId);
  if (!registeredNames?.length) return false;
  const running = getRunningProcesses();
  // Match with and without .exe since Get-Process strips the extension
  return registeredNames.some((name) => {
    const bare = name.replace(/\.exe$/i, "");
    return running.has(name) || running.has(bare);
  });
}

/** Find which registered game is currently running. Returns null if none detected. */
export function getRunningGame(): ServerGameAdapter | null {
  const running = getRunningProcesses();
  if (running.size === 0) return null;
  for (const adapter of adapters) {
    const names = processNameMap.get(adapter.id);
    if (names?.some((name) => {
      const bare = name.replace(/\.exe$/i, "");
      return running.has(name) || running.has(bare);
    })) return adapter;
  }
  return null;
}
