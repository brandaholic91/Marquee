import { useState, useEffect, useRef, type ReactNode } from "react";
import { api } from "../lib/api.js";
import { agencyEvents } from "../lib/sse.js";
import { useAgencyStore } from "../store/useAgencyStore.js";
import { Badge, AgentBadge } from "../components/ui/index.js";
import { Sidebar } from "../components/layout/Sidebar.js";
import { ChatDrawer } from "../components/chat/ChatDrawer.js";

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
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const monthDay = now.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const dateLabel = `${dayName} · ${monthDay}`;

  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
      <div>
        <div className="caption" style={{ marginBottom: 4 }}>{dateLabel}</div>
        <h1 className="headline-lg" style={{ margin: 0 }}>{greeting}, Balázs.</h1>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" onClick={onNewBrief}>New Brief</button>
      </div>
    </div>
  );
}

// ---- NewBriefForm ----

function NewBriefForm({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await api.briefs.create(text.trim());
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
        placeholder="Describe what you need…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={submitting}>
          Cancel
        </button>
        <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={submitting || !text.trim()}>
          Send brief
        </button>
      </div>
    </div>
  );
}

// ---- ApprovalsWidget ----

const PIPELINE_BADGE_MAP: Record<string, string> = {
  drafting: "secondary-soft",
  awaiting_eval: "cream",
  awaiting_approval: "primary-soft",
  shipped: "success-soft",
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
      title="Awaiting your approval"
      right={
        approvals.length > 0 ? (
          <Badge kind="primary-soft">{approvals.length}</Badge>
        ) : undefined
      }
    >
      {approvals.length === 0 ? (
        <div style={{ padding: "20px 18px", color: "var(--ink-3)", fontSize: 13 }}>
          No deliverables awaiting approval.
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
                    Approve
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setSelectedDeliverable(d.id)}
                  >
                    View
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
      title="Live"
      right={<span className="caption" style={{ color: "var(--ink-3)" }}>auto-scroll</span>}
    >
      <div className="scroll" style={{ height: 320, overflowY: "auto" }}>
        {events.length === 0 ? (
          <div style={{ padding: "20px 18px", color: "var(--ink-3)", fontSize: 13 }}>
            Waiting for activity…
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
          No pipeline data.
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
                  <span className={`badge badge-${badgeKind}`}>{row.status}</span>
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

// ---- ConversationsWidget ----

function ConversationsWidget({ threads }: { threads: Thread[] }) {
  const { setActiveThread } = useAgencyStore();

  return (
    <Widget title="Open chats">
      {threads.length === 0 ? (
        <div style={{ padding: "20px 18px", color: "var(--ink-3)", fontSize: 13 }}>
          No active threads.
        </div>
      ) : (
        <div>
          {threads.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setActiveThread(t.id)}
              style={{
                width: "100%",
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                borderBottom: i < threads.length - 1 ? "1px solid var(--rule)" : "none",
                textDecoration: "none",
                color: "var(--ink-1)",
                fontSize: 14,
                fontWeight: 500,
                lineHeight: 1.3,
                background: "none",
                border: "none",
                borderBottomColor: "var(--rule)",
                borderBottomStyle: "solid",
                borderBottomWidth: i < threads.length - 1 ? 1 : 0,
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
  const refreshPendingRef = useRef(false);

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
    agencyEvents.start();
    const unsub = agencyEvents.on("*", (ev) => {
      const typed = ev as { type?: string; payload?: unknown };
      setLiveEvents((prev) =>
        [
          {
            type: typed.type ?? "event",
            agentSlug: (typed.payload as { agentSlug?: string })?.agentSlug,
            payload: typed.payload,
            ts: Date.now(),
          },
          ...prev,
        ].slice(0, 50)
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
      <div style={{ display: "flex", minHeight: "calc(100vh - 36px)", background: "var(--cream)" }}>
        <Sidebar activeNav="home" />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", fontSize: 14 }}>
          Loading…
        </main>
        <ChatDrawer />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 36px)", background: "var(--cream)" }}>
      <Sidebar activeNav="home" activeAgents={activeAgentSlugs} />

      <main style={{ flex: 1, minWidth: 0, padding: "28px 32px 32px", overflow: "auto" }}>
        <HomeHeader onNewBrief={() => setShowBriefForm((v) => !v)} />

        {showBriefForm && (
          <NewBriefForm onClose={() => setShowBriefForm(false)} />
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 24 }}>
          <ApprovalsWidget approvals={snapshot.approvals} onRefresh={refresh} />
          <LiveFeedWidget events={liveEvents} />
          <PipelineWidget pipeline={snapshot.pipeline} />
          <ConversationsWidget threads={snapshot.threads} />
        </div>
      </main>

      <ChatDrawer />
    </div>
  );
}
