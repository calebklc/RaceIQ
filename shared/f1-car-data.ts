import { readFileSync } from "fs";
import { resolve } from "path";
import { SHARED_DIR } from "./resolve-data";

/** F1 team ID → team name */
const f1Teams = new Map<number, string>();
const teamsCSV = readFileSync(resolve(SHARED_DIR, "games/f1-2025/teams.csv"), "utf-8");
for (const line of teamsCSV.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  const [idStr, ...rest] = trimmed.split(",");
  const id = parseInt(idStr, 10);
  const name = rest.join(",");
  if (!isNaN(id) && name) f1Teams.set(id, name);
}

/** F1 driver ID → driver name */
const f1Drivers = new Map<number, string>();
const driversCSV = readFileSync(resolve(SHARED_DIR, "games/f1-2025/drivers.csv"), "utf-8");
for (const line of driversCSV.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  const [idStr, ...rest] = trimmed.split(",");
  const id = parseInt(idStr, 10);
  const name = rest.join(",");
  if (!isNaN(id) && name) f1Drivers.set(id, name);
}

/** Get F1 team name from team ID */
export function getF1TeamName(teamId: number): string {
  return f1Teams.get(teamId) ?? `Team ${teamId}`;
}

/** Get F1 driver name from driver ID */
export function getF1DriverName(driverId: number): string {
  return f1Drivers.get(driverId) ?? `Driver ${driverId}`;
}

/**
 * Get F1 car name from ordinal (team ID).
 */
export function getF1CarName(ordinal: number): string {
  return getF1TeamName(ordinal);
}

/** Visual compound ID → compound name */
const F1_COMPOUNDS: Record<number, string> = {
  16: "soft",
  17: "medium",
  18: "hard",
  7: "inter",
  8: "wet",
};

export function getF1CompoundName(visualCompound: number): string {
  return F1_COMPOUNDS[visualCompound] ?? "unknown";
}
