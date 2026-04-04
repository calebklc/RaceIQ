import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/fm23/tunes")({
  component: () => <Outlet />,
});
