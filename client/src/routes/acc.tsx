import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { useGameStore } from "../stores/game";

function AccLayout() {
  const setGameId = useGameStore((s) => s.setGameId);
  useEffect(() => {
    setGameId("acc");
    return () => setGameId(null);
  }, [setGameId]);
  return <Outlet />;
}

export const Route = createFileRoute("/acc")({
  component: AccLayout,
});
