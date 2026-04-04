import { createFileRoute } from "@tanstack/react-router";

function AccSetupPage() {
  return (
    <div className="flex items-center justify-center h-full text-app-text-dim">
      <div className="text-center space-y-2">
        <div className="text-lg font-semibold">ACC Setup</div>
        <div className="text-sm">Coming soon</div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/acc/setup/")({
  component: AccSetupPage,
});
