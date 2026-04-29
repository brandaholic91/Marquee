import { useState, useEffect, useRef, type ReactNode } from "react";
import { api } from "../lib/api.js";
import { agencyEvents } from "../lib/sse.js";
import { useAgencyStore } from "../store/useAgencyStore.js";
import { Badge, AgentBadge } from "../components/ui/index.js";
import { Sidebar } from "../components/layout/Sidebar.js";
import { useBreakpoint } from "../hooks/useBreakpoint.js";


// ---- Types ----

interface Deliverable {
  id: string;
  title: string;
  status: string;
  type?: string;
  currentRevisionId?: string;
  agentSlug?: string;
}

interface Thread {
  id: string;
  title: string;
}

interface AgentSession {
  id: string;
  agentSlug: string;
}

interface PipelineCount {
  status: string;
  count: number;
}

interface SnapshotData {
  approvals: Deliverable[];
  pipeline: PipelineCount[];
  activeAgents: AgentSession[];
  threads: Thread[];
}

interface LiveEvent {
  type: string;
  agentSlug?: string;
  payload: unknown;
  ts: number;
}

// ---- Widget chrome ----

function Widget({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="card" style={{ display: "flex", flexDirection: "column", minHeight: 320 }}>
      <header style={{
        padding: "16px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid var(--rule)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 className="title-md" style={{ margin: 0 }}>{title}</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{right}</div>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </section>
  );
}

// ---- HomeHeader ----

function HomeHeader({ onNewBrief }: { onNewBrief: () => void }) {
  const now = new Date();
  const dayName = now.toLocaleDateString("hu-HU", { weekday: "long" });
  const monthDay = now.toLocaleDateString("hu-HU", { month: "long", day: "numeric" });
  const dateLabel = `${dayName} · ${monthDay}`;

  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Jó reggelt" : hour < 17 ? "Jó napot" : "Jó estét";

  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
      <div>
        <div className="caption" style={{ marginBottom: 4 }}>{dateLabel}</div>
        <h1 className="headline-lg" style={{ margin: 0 }}>{greeting}, Balázs.</h1>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" onClick={onNewBrief}>Új brief</button>
      </div>
    </div>
  );
}

// ---- NewBriefForm ----

function NewBriefForm({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [campaigns, setCampaigns] = useState<import("../store/useAgencyStore.js").Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");

  useEffect(() => {
    api.campaigns.list().then(setCampaigns).catch(() => {});
  }, []);

  async function handleSubmit() {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await api.briefs.create(text.trim(), selectedCampaignId || undefined);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card" style={{ padding: "16px 18px", marginTop: 16 }}>
      <textarea
        className="textarea-chat"
        style={{ width: "100%", minHeight: 80, border: "1px solid var(--rule-strong)", borderRadius: 4, padding: 8, resize: "vertical" }}
        placeholder="Írd le, mire van szükséged…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {campaigns.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <label className="caption" style={{ display: "block", marginBottom: 4 }}>Kampány</label>
          <select
            value={selectedCampaignId}
            onChange={(e) => setSelectedCampaignId(e.target.value)}
            style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 4, background: "var(--parchment)", fontSize: 13 }}
          >
            <option value="">— Új kampány —</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={submitting}>
          Mégse
        </button>
        <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={submitting || !text.trim()}>
          Brief küldése
        </button>
      </div>
    </div>
  );
}

// ---- ApprovalsWidget ----

const PIPELINE_STATUS_LABEL: Record<string, string> = {
  drafting: "Vázlatkészítés",
  awaiting_eval: "Értékelésre vár",
  awaiting_approval: "Jóváhagyásra vár",
  shipped: "Kiszállítva",
  archived: "Elutasítva",
};

const PIPELINE_BADGE_MAP: Record<string, string> = {
  drafting: "secondary-soft",
  awaiting_eval: "cream",
  awaiting_approval: "primary-soft",
  shipped: "success-soft",
  archived: "cream",
  blocked: "danger-soft",
};

function ApprovalsWidget({
  approvals,
  onRefresh,
}: {
  approvals: Deliverable[];
  onRefresh: () => void;
}) {
  const { setSelectedDeliverable } = useAgencyStore();

  return (
    <Widget
      title="Jóváhagyásra vár"
      right={
        approvals.length > 0 ? (
          <Badge kind="primary-soft">{approvals.length}</Badge>
        ) : undefined
      }
    >
      {approvals.length === 0 ? (
        <div style={{ padding: "20px 18px", color: "var(--ink-3)", fontSize: 13 }}>
          Nincs jóváhagyásra váró deliverable.
        </div>
      ) : (
        <div>
          {approvals.map((d, i) => (
            <div
              key={d.id}
              style={{
                padding: "14px 18px",
                borderBottom: i < approvals.length - 1 ? "1px solid var(--rule)" : "none",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <button
                style={{
                  textDecoration: "none",
                  color: "var(--ink-1)",
                  fontSize: 14,
                  fontWeight: 500,
                  lineHeight: 1.35,
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
                onClick={() => setSelectedDeliverable(d.id)}
              >
                {d.title}
              </button>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {d.type && (
                    <Badge kind="cream" mono>{d.type}</Badge>
                  )}
                  {d.type && <span style={{ color: "var(--ink-3)", fontSize: 11 }}>·</span>}
                  {d.agentSlug && <AgentBadge slug={d.agentSlug} active />}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => api.approvals.decide(d.id, "approved").then(onRefresh).catch(console.error)}
                  >
                    Jóváhagyás
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setSelectedDeliverable(d.id)}
                  >
                    Megtekintés
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Widget>
  );
}

// ---- LiveFeedWidget ----

function LiveFeedWidget({ events }: { events: LiveEvent[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  return (
    <Widget
      title="Élő"
      right={<span className="caption" style={{ color: "var(--ink-3)" }}>auto-görgetés</span>}
    >
      <div className="scroll" style={{ height: 320, overflowY: "auto" }}>
        {events.length === 0 ? (
          <div style={{ padding: "20px 18px", color: "var(--ink-3)", fontSize: 13 }}>
            Aktivitásra várva…
          </div>
        ) : (
          events.map((ev, i) => {
            const ts = new Date(ev.ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
            const active = Boolean(ev.agentSlug);
            return (
              <div
                key={ev.ts + '-' + ev.type + '-' + i}
                style={{
                  padding: "6px 18px",
                  borderBottom: i < events.length - 1 ? "1px solid rgba(226, 219, 203, 0.5)" : "none",
                  display: "grid",
                  gridTemplateColumns: "14px 64px 130px 1fr",
                  alignItems: "center",
                  gap: 10,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                }}
              >
                <span style={{ color: active ? "var(--bulb)" : "var(--ink-3)", fontSize: 10 }}>
                  {active ? "●" : "○"}
                </span>
                <span style={{ color: "var(--ink-3)" }}>{ts}</span>
                <span style={{ color: "var(--ink-1)" }}>{ev.agentSlug ?? "—"}</span>
                <span style={{ color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ev.type}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </Widget>
  );
}

// ---- PipelineWidget ----

function PipelineWidget({ pipeline }: { pipeline: PipelineCount[] }) {
  return (
    <Widget title="Pipeline">
      {pipeline.length === 0 ? (
        <div style={{ padding: "20px 18px", color: "var(--ink-3)", fontSize: 13 }}>
          Nincs pipeline adat.
        </div>
      ) : (
        <div>
          {pipeline.map((row, i) => {
            const badgeKind = PIPELINE_BADGE_MAP[row.status] ?? "cream";
            return (
              <div
                key={row.status}
                style={{
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: i < pipeline.length - 1 ? "1px solid var(--rule)" : "none",
                  cursor: "default",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className={`badge badge-${badgeKind}`}>{PIPELINE_STATUS_LABEL[row.status] ?? row.status}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span className="serif" style={{ fontSize: 22, color: "var(--ink-1)" }}>{row.count}</span>
                  <span className="caption" style={{ color: "var(--ink-3)" }}>›</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Widget>
  );
}

// ---- UsageWidget ----

interface UsageStats {
  today: { tokens: number; costUsdCents: number; byAgent: { agentSlug: string; tokens: number; costUsdCents: number }[] };
  budgetCents: number;
  budgetUsedPct: number;
}

function UsageWidget({ stats }: { stats: UsageStats | null }) {
  if (!stats) return (
    <Widget title="Használat">
      <div style={{ padding: "20px 18px", color: "var(--ink-3)", fontSize: 13 }}>Betöltés…</div>
    </Widget>
  );

  const { today, budgetCents, budgetUsedPct } = stats;
  const fmtTokens = (n: number) => new Intl.NumberFormat().format(n);
  const barColor = budgetUsedPct >= 100 ? "var(--primary)" : budgetUsedPct >= 80 ? "var(--secondary)" : "var(--bulb)";

  return (
    <Widget title="Használat" right={<span className="caption" style={{ color: "var(--ink-3)" }}>ma</span>}>
      {today.tokens === 0 ? (
        <div style={{ padding: "20px 18px", color: "var(--ink-3)", fontSize: 13 }}>Még nincs aktivitás.</div>
      ) : (
        <div style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font-serif)", color: "var(--ink-1)", marginBottom: 4 }}>
            {fmtTokens(today.tokens)} <span style={{ fontSize: 13, fontWeight: 400, color: "var(--ink-3)" }}>tok</span>
          </div>
          {today.costUsdCents > 0 && (
            <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 8 }}>
              ≈ ${(today.costUsdCents / 100).toFixed(2)}
            </div>
          )}
          {budgetCents > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ height: 6, background: "var(--rule)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, budgetUsedPct)}%`, background: barColor, borderRadius: 3, transition: "width 0.3s" }} />
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 3 }}>{Math.round(budgetUsedPct)}% a napi limitből</div>
            </div>
          )}
          <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 10 }}>
            {today.byAgent.slice(0, 3).map((a) => (
              <div key={a.agentSlug} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12 }}>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}>{a.agentSlug}</span>
                <span style={{ color: "var(--ink-3)" }}>{fmtTokens(a.tokens)} tok</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Widget>
  );
}

// ---- QualityWidget ----

interface QualityStats {
  days: { date: string; brand_voice: number; factual_accuracy: number; usp_usage: number; count: number }[];
  avg: { brand_voice: number; factual_accuracy: number; usp_usage: number };
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <span style={{ color: "var(--ink-3)", fontSize: 11 }}>—</span>;
  const W = 120, H = 20;
  const xStep = W / (values.length - 1);
  const toY = (v: number) => H - ((v - 1) / (5 - 1)) * H;
  const points = values.map((v, i) => `${i * xStep},${toY(v)}`).join(" ");
  return (
    <svg width={W} height={H} style={{ display: "inline-block", verticalAlign: "middle" }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const DIM_COLOR: Record<string, string> = {
  brand_voice: "var(--bulb)",
  factual_accuracy: "#4a9e8e",
  usp_usage: "#7c6fbf",
};

const DIM_LABEL: Record<string, string> = {
  brand_voice: "brand voice",
  factual_accuracy: "factual acc.",
  usp_usage: "usp usage",
};

function QualityWidget({ stats }: { stats: QualityStats | null }) {
  if (!stats) return (
    <Widget title="Quality">
      <div style={{ padding: "20px 18px", color: "var(--ink-3)", fontSize: 13 }}>Betöltés…</div>
    </Widget>
  );
  if (stats.days.length === 0) return (
    <Widget title="Minőség" right={<span className="caption" style={{ color: "var(--ink-3)" }}>elmúlt 30 nap</span>}>
      <div style={{ padding: "20px 18px", color: "var(--ink-3)", fontSize: 13 }}>Még nincs értékelés.</div>
    </Widget>
  );

  const dims = ["brand_voice", "factual_accuracy", "usp_usage"] as const;
  return (
    <Widget title="Minőség" right={<span className="caption" style={{ color: "var(--ink-3)" }}>elmúlt 30 nap</span>}>
      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        {dims.map((dim) => (
          <div key={dim} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 72, fontSize: 12, color: "var(--ink-2)", flexShrink: 0 }}>
              {DIM_LABEL[dim]}
            </span>
            <span style={{ width: 28, fontSize: 13, fontWeight: 600, color: "var(--ink-1)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
              {stats.avg[dim].toFixed(1)}
            </span>
            <Sparkline values={stats.days.map((d) => d[dim])} color={DIM_COLOR[dim]} />
          </div>
        ))}
      </div>
    </Widget>
  );
}

// ---- ConversationsWidget ----

function ConversationsWidget({ threads, onRefresh }: { threads: Thread[]; onRefresh: () => void }) {
  const { setActiveThread, setView } = useAgencyStore();
  const [creating, setCreating] = useState(false);

  async function handleNewChat() {
    setCreating(true);
    try {
      const { id } = await api.threads.create("New conversation");
      setActiveThread(id);
      setView("chat");
      onRefresh();
    } finally {
      setCreating(false);
    }
  }

  function openThread(id: string) {
    setActiveThread(id);
    setView("chat");
  }

  return (
    <Widget
      title="Nyitott chatok"
      right={
        <button className="btn btn-ghost btn-sm" onClick={handleNewChat} disabled={creating}>
          + új
        </button>
      }
    >
      {threads.length === 0 ? (
        <div style={{ padding: "20px 18px", color: "var(--ink-3)", fontSize: 13 }}>
          Nincs aktív szál.{" "}
          <button
            onClick={handleNewChat}
            style={{ color: "var(--primary)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}
          >
            Indíts egyet
          </button>
        </div>
      ) : (
        <div style={{ maxHeight: 280, overflowY: "auto" }}>
          {threads.map((t, i) => (
            <button
              key={t.id}
              onClick={() => openThread(t.id)}
              style={{
                width: "100%",
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                borderBottom: i < threads.length - 1 ? "1px solid var(--rule)" : "none",
                color: "var(--ink-1)",
                fontSize: 14,
                fontWeight: 500,
                lineHeight: 1.3,
                background: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {t.title}
            </button>
          ))}
        </div>
      )}
    </Widget>
  );
}

// ---- HomeView ----

export function HomeView() {
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [showBriefForm, setShowBriefForm] = useState(false);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [qualityStats, setQualityStats] = useState<QualityStats | null>(null);
  const refreshPendingRef = useRef(false);
  const { isMobile } = useBreakpoint();

  const refresh = () => {
    if (refreshPendingRef.current) return;
    refreshPendingRef.current = true;
    api.snapshot().then((data) => {
      setSnapshot(data as SnapshotData);
      refreshPendingRef.current = false;
    });
  };

  useEffect(() => {
    refresh();
    api.stats.usage().then(setUsageStats).catch(() => {});
    api.stats.quality().then(setQualityStats).catch(() => {});
    agencyEvents.start();
    const unsub = agencyEvents.on("*", (ev) => {
      const typed = ev as { type?: string; agentSlug?: string };
      setLiveEvents((prev) =>
        [
          {
            type: typed.type ?? "event",
            agentSlug: typed.agentSlug,
            payload: ev,
            ts: Date.now(),
          },
          ...prev,
        ].slice(-50)
      );
      refresh();
    });
    return () => {
      unsub();
      agencyEvents.stop();
    };
  }, []);

  const activeAgentSlugs = snapshot?.activeAgents.map((a) => a.agentSlug) ?? [];

  if (!snapshot) {
    return (
      <div style={{ display: "flex", height: "100%", background: "var(--cream)" }}>
        <Sidebar activeNav="home" />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", fontSize: 14 }}>
          Loading…
        </main>

      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%", background: "var(--cream)" }}>
      <Sidebar activeNav="home" />

      <main style={{ flex: 1, minWidth: 0, padding: isMobile ? "20px 16px 88px" : "28px 32px 32px", overflow: "auto" }}>
        <HomeHeader onNewBrief={() => setShowBriefForm((v) => !v)} />

        {showBriefForm && (
          <NewBriefForm onClose={() => setShowBriefForm(false)} />
        )}

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20, marginTop: 24 }}>
          <ApprovalsWidget approvals={snapshot.approvals} onRefresh={refresh} />
          <LiveFeedWidget events={liveEvents} />
          <PipelineWidget pipeline={snapshot.pipeline} />
          <ConversationsWidget threads={snapshot.threads} onRefresh={refresh} />
          <UsageWidget stats={usageStats} />
          <QualityWidget stats={qualityStats} />
        </div>
      </main>


    </div>
  );
}
