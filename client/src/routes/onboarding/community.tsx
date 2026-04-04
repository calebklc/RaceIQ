import { createFileRoute } from "@tanstack/react-router";
import { StepCommunity } from "../../components/Onboarding";

export const Route = createFileRoute("/onboarding/community")({
  component: StepCommunity,
});
