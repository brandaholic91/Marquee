import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAgencyStore } from "../store/useAgencyStore";

interface DeliverableData {
  id: string; title: string; status: string; type: string;
  currentRevisionId?: string; delegationId: string;
}

interface RevisionData { id: string; contentMd: string; title: string; }

export function DeliverableView() {
  const { selectedDeliverableId, setView } = useAgencyStore();
  const [deliverable, setDeliverable] = useState<DeliverableData | null>(null);
  const [revision, setRevision] = useState<RevisionData | null>(null);

  useEffect(() => {
    if (!selectedDeliverableId) return;
    api.deliverables.get(selectedDeliverableId).then((d: DeliverableData) => {
      setDeliverable(d);
      if (d.currentRevisionId) {
        api.deliverables.revision(selectedDeliverableId, d.currentRevisionId).then(setRevision);
      }
    });
  }, [selectedDeliverableId]);

  if (!deliverable) return (
    <div className="flex items-center justify-center h-full text-[hsl(var(--muted-foreground))]">
      Select a deliverable
    </div>
  );

  const statusColor: Record<string, string> = {
    drafting: "bg-blue-100 text-blue-700",
    awaiting_eval: "bg-yellow-100 text-yellow-700",
    awaiting_approval: "bg-orange-100 text-orange-700",
    shipped: "bg-green-100 text-green-700",
    archived: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-[hsl(var(--border))]">
        <button
          className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          onClick={() => setView("home")}
        >
          ← Back
        </button>
        <h1 className="font-semibold flex-1">{deliverable.title}</h1>
        <span className={`text-xs px-2 py-1 rounded font-medium ${statusColor[deliverable.status] ?? "bg-gray-100"}`}>
          {deliverable.status.replace(/_/g, " ")}
        </span>
        {deliverable.status === "awaiting_approval" && (
          <div className="flex gap-2">
            <button
              className="text-sm bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-3 py-1.5 rounded"
              onClick={() => api.approvals.decide(deliverable.id, "approved").then(() => setView("home"))}
            >
              Approve
            </button>
            <button
              className="text-sm border border-[hsl(var(--border))] px-3 py-1.5 rounded hover:bg-[hsl(var(--muted))]"
              onClick={() => api.approvals.decide(deliverable.id, "requested_changes").then(() => setView("home"))}
            >
              Request changes
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {revision ? (
          <article className="prose max-w-none">
            <pre className="whitespace-pre-wrap text-sm font-mono bg-[hsl(var(--muted))] p-4 rounded">
              {revision.contentMd}
            </pre>
          </article>
        ) : (
          <p className="text-[hsl(var(--muted-foreground))]">No revision available yet.</p>
        )}
      </div>
    </div>
  );
}
