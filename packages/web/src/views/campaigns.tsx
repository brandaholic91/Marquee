import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Sidebar } from "../components/layout/Sidebar.js";
import { useBreakpoint } from "../hooks/useBreakpoint.js";
import type { Campaign, CampaignDetail } from "../store/useAgencyStore.js";

const STATUS_COLOR: Record<string, string> = {
  active: "var(--success, #2d7a4f)",
  completed: "var(--ink-2)",
  archived: "var(--ink-3)",
};

function CampaignDetailPanel({ campaign, isMobile = false }: { campaign: CampaignDetail; isMobile?: boolean }) {
  const pad = isMobile ? 16 : 32;
  const deliverablesByStatus = campaign.deliverables.reduce<Record<string, number>>((acc, d) => {
    acc[d.status] = (acc[d.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ padding: `0 ${pad}px` }}>
      <div style={{ marginBottom: 24 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
          color: STATUS_COLOR[campaign.status] ?? "var(--ink-2)",
          padding: "2px 8px", borderRadius: 3, border: `1px solid currentColor`,
        }}>
          {campaign.status}
        </span>
      </div>

      {campaign.description && (
        <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 20, lineHeight: 1.5 }}>
          {campaign.description}
        </p>
      )}

      <div style={{ marginBottom: 20 }}>
        <div className="caption" style={{ marginBottom: 8 }}>Briefs ({campaign.briefs.length})</div>
        {campaign.briefs.length === 0
          ? <div style={{ fontSize: 13, color: "var(--ink-3)" }}>None yet</div>
          : campaign.briefs.map((b) => {
              const statusLabel = b.status === "draft" ? "Draft" : b.status === "dispatched" ? "In progress" : "Done";
              const title = b.contentMd.split("\n")[0].replace(/^#+\s*/, "").trim().slice(0, 60) || "Untitled brief";
              return (
                <div key={b.id} style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 4, display: "flex", gap: 8 }}>
                  <span style={{ color: "var(--ink-3)", flexShrink: 0 }}>{statusLabel}</span>
                  <span>{title}</span>
                </div>
              );
            })
        }
      </div>

      <div style={{ marginBottom: 20 }}>
        <div className="caption" style={{ marginBottom: 8 }}>Deliverables ({campaign.deliverables.length})</div>
        {campaign.deliverables.length === 0
          ? <div style={{ fontSize: 13, color: "var(--ink-3)" }}>None yet</div>
          : Object.entries(deliverablesByStatus).map(([status, count]) => (
            <div key={status} style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 4 }}>
              {count}× {status.replace(/_/g, " ")}
            </div>
          ))
        }
      </div>

      <div>
        <div className="caption" style={{ marginBottom: 8 }}>Tasks ({campaign.tasks.length})</div>
        {campaign.tasks.length === 0
          ? <div style={{ fontSize: 13, color: "var(--ink-3)" }}>None yet</div>
          : campaign.tasks.slice(0, 8).map((t) => (
            <div key={t.id} style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 4, display: "flex", gap: 8 }}>
              <span style={{ color: "var(--ink-3)" }}>{t.assignedTo}</span>
              <span>{t.title}</span>
            </div>
          ))
        }
      </div>
    </div>
  );
}

export function CampaignsView() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"list" | "detail">("list");
  const { isMobile } = useBreakpoint();

  useEffect(() => {
    api.campaigns.list().then(setCampaigns).catch(() => {});
  }, []);

  async function handleSelect(id: string) {
    setSelected(null);
    setLoading(true);
    try {
      const detail = await api.campaigns.get(id);
      setSelected(detail as CampaignDetail);
      if (isMobile) setMobilePanel("detail");
    } finally {
      setLoading(false);
    }
  }

  const listPanel = (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {campaigns.length === 0
        ? <div style={{ padding: "40px 20px", color: "var(--ink-3)", fontSize: 13 }}>No campaigns yet. Create a brief to start one.</div>
        : campaigns.map((c) => (
          <button
            key={c.id}
            onClick={() => handleSelect(c.id)}
            style={{
              display: "flex", width: "100%", textAlign: "left",
              padding: isMobile ? "14px 16px" : "10px 20px",
              border: "none", borderBottom: "1px solid var(--rule)",
              background: selected?.id === c.id ? "var(--primary-soft)" : "transparent",
              color: selected?.id === c.id ? "var(--primary-deep)" : "var(--ink-1)",
              fontSize: 13, cursor: "pointer",
              justifyContent: "space-between", alignItems: "center", gap: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.title}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
                {c.briefCount ?? 0} brief{c.briefCount !== 1 ? "s" : ""} · {c.deliverableCount ?? 0} deliverable{c.deliverableCount !== 1 ? "s" : ""} · {c.taskCount ?? 0} tasks
                {(c.pendingApprovals ?? 0) > 0 && <span style={{ color: "var(--accent)" }}> · {c.pendingApprovals} pending</span>}
              </div>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
              color: STATUS_COLOR[c.status] ?? "var(--ink-3)",
            }}>
              {c.status}
            </span>
          </button>
        ))
      }
    </div>
  );

  const detailPanel = selected ? (
    <div>
      {isMobile && (
        <button
          onClick={() => setMobilePanel("list")}
          style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 13, padding: "0 16px", marginBottom: 12 }}
        >
          ← Campaigns
        </button>
      )}
      <h2 className="heading" style={{ padding: `0 ${isMobile ? 16 : 32}px`, marginBottom: 16, fontSize: 18 }}>
        {loading ? "…" : selected.title}
      </h2>
      {!loading && <CampaignDetailPanel campaign={selected} isMobile={isMobile} />}
    </div>
  ) : (
    <div style={{ padding: "40px 32px", color: "var(--ink-3)", fontSize: 13 }}>
      Select a campaign to view details
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar activeNav="campaigns" />
      <main style={{ flex: 1, overflow: "auto", padding: isMobile ? "20px 0 88px" : "28px 0" }}>
        <h1 className="heading" style={{ padding: `0 ${isMobile ? 16 : 32}px`, marginBottom: 24 }}>Campaigns</h1>

        {isMobile ? (
          mobilePanel === "list" ? listPanel : detailPanel
        ) : (
          <div style={{ display: "flex", gap: 0 }}>
            <div style={{ width: 280, flexShrink: 0, borderRight: "1px solid var(--rule)", overflowY: "auto" }}>
              {listPanel}
            </div>
            <div style={{ flex: 1 }}>{detailPanel}</div>
          </div>
        )}
      </main>
    </div>
  );
}
