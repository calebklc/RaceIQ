import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/fm23/setup")({
  component: () => <Outlet />,
});
