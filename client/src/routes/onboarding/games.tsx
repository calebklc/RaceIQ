import { createFileRoute } from "@tanstack/react-router";
import { StepGames } from "../../components/Onboarding";

export const Route = createFileRoute("/onboarding/games")({
  component: StepGames,
});
