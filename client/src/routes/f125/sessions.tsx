import { createFileRoute } from "@tanstack/react-router";
import { SessionsPage } from "../../components/SessionsPage";

export const Route = createFileRoute("/f125/sessions")({
  component: SessionsPage,
});
