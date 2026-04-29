import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { api } from "../lib/api.js";
import { useAgencyStore, type Campaign } from "../store/useAgencyStore.js";
import { Sidebar } from "../components/layout/Sidebar.js";
import { useBreakpoint } from "../hooks/useBreakpoint.js";

interface Deliverable {
  id: string;
  title: string;
  type: string;
  status: string;
  updatedAt?: string;
  campaignId?: string | null;
}

const COLUMNS = [
  { status: "drafting", label: "Vázlatkészítés" },
  { status: "awaiting_eval", label: "Értékelésre vár" },
  { status: "awaiting_approval", label: "Jóváhagyásra vár" },
  { status: "shipped", label: "Kiszállítva" },
  { status: "archived", label: "Archivált" },
];

const STATUS_COLOR: Record<string, string> = {
  drafting: "var(--neutral-mid)",
  awaiting_eval: "var(--primary)",
  awaiting_approval: "var(--accent)",
  shipped: "var(--success, #2d7a4f)",
  archived: "var(--neutral-mid)",
};

function DeliverableCard({
  d,
  onClick,
}: {
  d: Deliverable;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: d.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      style={{
        background: "var(--parchment)",
        border: "1px solid var(--rule)",
        borderRadius: 8,
        padding: "12px 14px",
        cursor: isDragging ? "grabbing" : "pointer",
        opacity: isDragging ? 0.4 : 1,
        touchAction: "none",
      }}
    >
      <div className="body-sm" style={{ fontWeight: 500, marginBottom: 4 }}>{d.title}</div>
      <div className="caption" style={{ opacity: 0.6 }}>{d.type.replace(/_/g, " ")}</div>
    </div>
  );
}

function Column({
  status,
  label,
  cards,
  onCardClick,
}: {
  status: string;
  label: string;
  cards: Deliverable[];
  onCardClick: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      style={{
        minWidth: 240,
        maxWidth: 280,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        background: isOver ? "var(--primary-soft)" : "transparent",
        borderRadius: 8,
        padding: 4,
        transition: "background 0.15s",
      }}
    >
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
        <span className="caption" style={{ marginLeft: "auto", opacity: 0.5 }}>{cards.length}</span>
      </div>
      {cards.map((d) => (
        <DeliverableCard key={d.id} d={d} onClick={() => onCardClick(d.id)} />
      ))}
      {cards.length === 0 && (
        <div className="caption" style={{ opacity: 0.35, padding: "8px 2px" }}>Üres</div>
      )}
    </div>
  );
}

export function PipelineView() {
  const setSelectedDeliverable = useAgencyStore((s) => s.setSelectedDeliverable);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignFilter, setCampaignFilter] = useState<string>("");
  const [dragging, setDragging] = useState<Deliverable | null>(null);
  const { isMobile } = useBreakpoint();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = useCallback(() => {
    api.deliverables.list().then((rows: Deliverable[]) => setDeliverables(rows));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.campaigns.list().then(setCampaigns).catch(() => {});
  }, []);

  const activeCampaignIds = new Set(campaigns.filter((c) => c.status !== "archived").map((c) => c.id));
  const visibleDeliverables = deliverables.filter((d) => !d.campaignId || activeCampaignIds.has(d.campaignId));
  const filtered = campaignFilter
    ? visibleDeliverables.filter((d) => d.campaignId === campaignFilter)
    : visibleDeliverables;

  const byStatus = (status: string) => filtered.filter((d) => d.status === status);

  const handleDragStart = ({ active }: { active: { id: string | number } }) => {
    setDragging(deliverables.find((d) => d.id === String(active.id)) ?? null);
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setDragging(null);
    if (!over) return;
    const card = deliverables.find((d) => d.id === String(active.id));
    const newStatus = String(over.id);
    if (!card || card.status === newStatus) return;
    // optimistic update
    setDeliverables((prev) =>
      prev.map((d) => (d.id === card.id ? { ...d, status: newStatus } : d)),
    );
    const result = await api.deliverables.patchStatus(card.id, newStatus);
    if (!result.ok) {
      // revert on rejection
      setDeliverables((prev) =>
        prev.map((d) => (d.id === card.id ? { ...d, status: card.status } : d)),
      );
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar activeNav="pipeline" />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: isMobile ? "16px 16px 10px" : "20px 28px 12px", borderBottom: "1px solid var(--rule)", flexShrink: 0 }}>
          <div className="headline-md">Pipeline</div>
          <div className="body-sm" style={{ marginTop: 2 }}>
            {filtered.length} deliverable
          </div>
          {campaigns.length > 0 && (
            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              style={{
                marginTop: 8,
                padding: "4px 8px",
                border: "1px solid var(--rule)",
                borderRadius: 4,
                background: "var(--parchment)",
                fontSize: 12,
                color: "var(--ink-2)",
              }}
            >
              <option value="">Összes kampány</option>
              {campaigns.filter((c) => c.status !== "archived").map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          )}
        </div>
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={{ flex: 1, overflow: "auto", padding: isMobile ? "16px 12px 88px" : "20px 24px", display: "flex", gap: 16 }}>
            {COLUMNS.map(({ status, label }) => (
              <Column
                key={status}
                status={status}
                label={label}
                cards={byStatus(status)}
                onCardClick={(id) => setSelectedDeliverable(id)}
              />
            ))}
          </div>
          <DragOverlay>
            {dragging && (
              <div
                style={{
                  background: "var(--parchment)",
                  border: "1px solid var(--primary)",
                  borderRadius: 8,
                  padding: "12px 14px",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                  cursor: "grabbing",
                }}
              >
                <div className="body-sm" style={{ fontWeight: 500 }}>{dragging.title}</div>
                <div className="caption" style={{ opacity: 0.6 }}>{dragging.type.replace(/_/g, " ")}</div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  );
}
