import { create } from "zustand";
import type { GameId } from "@shared/types";

/** Map gameId → route path segment. Derived from each adapter's routePrefix. */
const GAME_ROUTES: Record<string, string> = {
  "fm-2023": "/fm23",
  "f1-2025": "/f125",
  "acc": "/acc",
};

interface GameState {
  gameId: GameId | null;
  setGameId: (id: GameId | null) => void;
}

export const useGameStore = create<GameState>((set) => ({
  gameId: null,
  setGameId: (gameId) => set({ gameId }),
}));

export function useGameId(): GameId | null {
  return useGameStore((s) => s.gameId);
}

/** Get the route path for the current game (e.g. "/fm23", "/f125", "/acc") */
export function useGameRoute(): string {
  const gameId = useGameId();
  return gameId ? (GAME_ROUTES[gameId] ?? `/${gameId}`) : "/fm23";
}

/** Get the route path for any gameId */
export function getGameRoute(gameId: string): string {
  return GAME_ROUTES[gameId] ?? `/${gameId}`;
}
