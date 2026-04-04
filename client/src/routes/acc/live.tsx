import { createFileRoute } from "@tanstack/react-router";
import { LivePage } from "../../components/LivePage";

export const Route = createFileRoute("/acc/live")({
  component: LivePage,
});
