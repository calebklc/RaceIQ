import { createFileRoute } from "@tanstack/react-router";
import { F1LiveDashboard } from "../../components/f1/F1LiveDashboard";

export const Route = createFileRoute("/f125/live")({
  component: F1LiveDashboard,
});
