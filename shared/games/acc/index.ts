import type { GameAdapter } from "../types";

export const accAdapter: GameAdapter = {
  id: "acc",
  displayName: "Assetto Corsa Competizione",
  shortName: "ACC",
  routePrefix: "acc",
  coordSystem: "standard-xyz",
  steeringCenter: 0,
  steeringRange: 1,

  // Stubs — server adapter overrides with real CSV-backed lookups
  getCarName(ordinal: number): string {
    return `Car #${ordinal}`;
  },

  getTrackName(ordinal: number): string {
    return `Track #${ordinal}`;
  },

  getSharedTrackName(): string | undefined {
    return undefined;
  },
};
