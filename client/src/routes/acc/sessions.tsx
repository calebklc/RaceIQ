import { createFileRoute } from "@tanstack/react-router";
import { SessionsPage } from "../../components/SessionsPage";

export const Route = createFileRoute("/acc/sessions")({
  component: SessionsPage,
});
