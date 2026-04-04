import { createFileRoute } from "@tanstack/react-router";
import { LivePage } from "../../../components/LivePage";

export const Route = createFileRoute("/fm23/live/driver")({
  component: () => <LivePage mode="driver" />,
});
