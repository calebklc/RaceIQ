import { readFileSync } from "fs";
import { resolve } from "path";
import { SHARED_DIR } from "./resolve-data";

export interface F1TrackInfo {
  name: string;
  location: string;
  country: string;
  variant: string;
  lengthKm: number;
  /** Name of the shared outline file (without extension), or empty if unavailable */
  sharedOutline: string;
}

/** F1 track ID → track info */
const f1Tracks = new Map<number, F1TrackInfo>();

// Format: id,name,location,country,variant,lengthKm,sharedOutline
const csv = readFileSync(resolve(SHARED_DIR, "games/f1-2025/tracks.csv"), "utf-8");
for (const line of csv.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  const [idStr, name, location, country, variant, lengthStr, sharedOutline] = trimmed.split(",");
  const id = parseInt(idStr, 10);
  const lengthKm = parseFloat(lengthStr);
  if (!isNaN(id) && name) {
    f1Tracks.set(id, {
      name,
      location,
      country,
      variant,
      lengthKm: isNaN(lengthKm) ? 0 : lengthKm,
      sharedOutline: sharedOutline?.trim() ?? "",
    });
  }
}

/** Get F1 track name from track ID */
export function getF1TrackName(trackId: number): string {
  return f1Tracks.get(trackId)?.name ?? `Track ${trackId}`;
}

/** Get F1 track info from track ID */
export function getF1TrackInfo(trackId: number): F1TrackInfo | undefined {
  return f1Tracks.get(trackId);
}

/** Get all F1 tracks as a Map of id → info */
export function getF1Tracks(): Map<number, F1TrackInfo> {
  return f1Tracks;
}
