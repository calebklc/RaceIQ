import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/f125/tunes/")({
  component: () => <Navigate to="/f125/tracks" search={{ tab: "setups" }} />,
});
