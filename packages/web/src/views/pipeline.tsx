import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api.js";
import { useAgencyStore } from "../store/useAgencyStore.js";
import { Sidebar } from "../components/layout/Sidebar.js";

interface Deliverable {
  id: string;
  title: string;
  type: string;
  status: string;
  updatedAt?: string;
}

const COLUMNS = [
  { status: "drafting", label: "Drafting" },
  { status: "awaiting_eval", label: "Awaiting Eval" },
  { status: "awaiting_approval", label: "Awaiting Approval" },
  { status: "shipped", label: "Shipped" },
  { status: "archived", label: "Archived" },
];

const STATUS_COLOR: Record<string, string> = {
  drafting: "var(--neutral-mid)",
  awaiting_eval: "var(--primary)",
  awaiting_approval: "var(--accent)",
  shipped: "var(--success, #2d7a4f)",
  archived: "var(--neutral-mid)",
};

export function PipelineView() {
  const setSelectedDeliverable = useAgencyStore((s) => s.setSelectedDeliverable);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);

  const load = useCallback(() => {
    api.deliverables.list().then((rows: Deliverable[]) => setDeliverables(rows));
  }, []);

  useEffect(() => { load(); }, [load]);

  const byStatus = (status: string) =>
    deliverables.filter((d) => d.status === status);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar activeNav="pipeline" />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "20px 28px 12px", borderBottom: "1px solid var(--rule)", flexShrink: 0 }}>
          <div className="headline-md">Pipeline</div>
          <div className="body-sm" style={{ marginTop: 2 }}>
            {deliverables.length} deliverable{deliverables.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Columns */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", display: "flex", gap: 16 }}>
          {COLUMNS.map(({ status, label }) => {
            const cards = byStatus(status);
            return (
              <div
                key={status}
                style={{
                  minWidth: 240, maxWidth: 280, flexShrink: 0,
                  display: "flex", flexDirection: "column", gap: 8,
                }}
              >
                {/* Column header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div
                    style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: STATUS_COLOR[status],
                    }}
                  />
                  <span className="caption" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {label}
                  </span>
                  <span className="caption" style={{ marginLeft: "auto", opacity: 0.5 }}>
                    {cards.length}
                  </span>
                </div>

                {/* Cards */}
                {cards.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => setSelectedDeliverable(d.id)}
                    style={{
                      background: "var(--parchment)",
                      border: "1px solid var(--rule)",
                      borderRadius: 8,
                      padding: "12px 14px",
                      cursor: "pointer",
                    }}
                  >
                    <div className="body-sm" style={{ fontWeight: 500, marginBottom: 4 }}>
                      {d.title}
                    </div>
                    <div className="caption" style={{ opacity: 0.6 }}>
                      {d.type.replace(/_/g, " ")}
                    </div>
                  </div>
                ))}

                {cards.length === 0 && (
                  <div className="caption" style={{ opacity: 0.35, padding: "8px 2px" }}>
                    Empty
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
