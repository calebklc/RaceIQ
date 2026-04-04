import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { TuneForm } from "../../../components/TuneForm";
import { useCreateTune } from "../../../hooks/queries";

function NewTunePage() {
  const navigate = useNavigate();
  const createTune = useCreateTune();

  return (
    <div className="flex-1 overflow-auto">
      <TuneForm
        title="Create New Tune"
        onCancel={() => navigate({ to: "/fm23/tunes" })}
        onSubmit={(data) => createTune.mutate(data as any, { onSuccess: () => navigate({ to: "/fm23/tunes" }) })}
        isSubmitting={createTune.isPending}
      />
    </div>
  );
}

export const Route = createFileRoute("/fm23/tunes/new")({
  component: NewTunePage,
});
