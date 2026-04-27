import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api.js";
import { useAgencyStore } from "../store/useAgencyStore.js";
import { AgentBadge } from "../components/ui/index.js";
import { Avatar } from "../components/ui/Avatar.js";
import { Bulb } from "../components/ui/Bulb.js";
import { Sidebar } from "../components/layout/Sidebar.js";
import type { AvatarWho } from "../components/ui/Avatar.js";

// ---- Types ----

interface DeliverableData {
  id: string;
  title: string;
  status: string;
  type?: string;
  currentRevisionId?: string;
  delegationId?: string;
  agentSlug?: string;
  wordCount?: number;
  revisionNumber?: string;
}

interface RevisionData {
  id: string;
  contentMd: string;
  title?: string;
  revisionNumber?: string;
  agentSlug?: string;
  createdAt?: string;
  note?: string;
}

interface EvalDimension {
  dim: string;
  score: number;
}

interface EvalReport {
  dimensions?: EvalDimension[];
  summary?: string;
  revisionId?: string;
  judgeSlug?: string;
  createdAt?: string;
}

const VALID_AVATAR_SLUGS: AvatarWho[] = [
  "human", "director", "content-lead", "copywriter",
  "eval-judge", "analytics", "distribution-lead", "insights-lead",
];

function safeAvatarWho(slug: string): AvatarWho {
  return VALID_AVATAR_SLUGS.includes(slug as AvatarWho)
    ? (slug as AvatarWho)
    : "director";
}

// ---- Simple Markdown Renderer ----

function renderMarkdown(md: string): React.ReactNode[] {
  const blocks = md.split(/\n{2,}/);
  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    // Headings
    const h1Match = trimmed.match(/^# (.+)$/);
    if (h1Match) {
      return (
        <h1 key={i} className="headline-lg" style={{ margin: "28px 0 10px" }}>
          {h1Match[1]}
        </h1>
      );
    }
    const h2Match = trimmed.match(/^## (.+)$/);
    if (h2Match) {
      return (
        <h2 key={i} className="headline-md" style={{ margin: "28px 0 10px", fontSize: 22 }}>
          {h2Match[1]}
        </h2>
      );
    }
    const h3Match = trimmed.match(/^### (.+)$/);
    if (h3Match) {
      return (
        <h3 key={i} className="title-md" style={{ margin: "22px 0 8px" }}>
          {h3Match[1]}
        </h3>
      );
    }

    // Blockquote
    if (trimmed.startsWith(">")) {
      const quoteText = trimmed.replace(/^>\s?/gm, "");
      return (
        <blockquote key={i} style={{
          margin: "24px 0", padding: "12px 20px",
          borderLeft: "3px solid var(--primary)",
          background: "var(--primary-soft)", color: "var(--primary-deep)",
          fontFamily: "var(--font-serif)", fontSize: 18, lineHeight: 1.5,
          fontStyle: "italic",
        }}>
          {quoteText}
        </blockquote>
      );
    }

    // Unordered list
    if (trimmed.split("\n").every(l => l.match(/^[-*] /))) {
      const items = trimmed.split("\n").map(l => l.replace(/^[-*] /, ""));
      return (
        <ul key={i} className="body-md" style={{ fontSize: 16, lineHeight: 1.8, paddingLeft: 24 }}>
          {items.map((item, j) => (
            <li key={j}>{inlineFormat(item)}</li>
          ))}
        </ul>
      );
    }

    // Ordered list
    if (trimmed.split("\n").every(l => l.match(/^\d+\. /))) {
      const items = trimmed.split("\n").map(l => l.replace(/^\d+\. /, ""));
      return (
        <ol key={i} className="body-md" style={{ fontSize: 16, lineHeight: 1.8, paddingLeft: 24 }}>
          {items.map((item, j) => (
            <li key={j}>{inlineFormat(item)}</li>
          ))}
        </ol>
      );
    }

    // Horizontal rule
    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      return <hr key={i} className="hr" style={{ margin: "24px 0" }} />;
    }

    // Default paragraph
    return (
      <p key={i} className="body-md" style={{ fontSize: 16, lineHeight: 1.7 }}>
        {inlineFormat(trimmed)}
      </p>
    );
  });
}

function inlineFormat(text: string): React.ReactNode {
  // Parse **bold**, *italic*, `code` inline
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    if (match[1]) {
      parts.push(<strong key={idx++}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={idx++}>{match[4]}</em>);
    } else if (match[5]) {
      parts.push(<code key={idx++} style={{ fontFamily: "var(--font-mono)", fontSize: "0.9em", background: "var(--parchment)", padding: "1px 4px", borderRadius: 3 }}>{match[6]}</code>);
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    parts.push(text.slice(last));
  }

  return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : <>{parts}</>;
}

// ---- Word count helper ----

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function estimateReadMin(words: number): number {
  return Math.max(1, Math.round(words / 200));
}

// ---- DeliverableTopBar ----

interface TopBarProps {
  deliverable: DeliverableData;
  revision: RevisionData | null;
  onApprove: () => void;
  onRequestChanges: () => void;
  onReject: () => void;
}

function DeliverableTopBar({ deliverable, revision, onApprove, onRequestChanges, onReject }: TopBarProps) {
  const { setView } = useAgencyStore();

  const wordCount = revision?.contentMd ? countWords(revision.contentMd) : deliverable.wordCount ?? null;
  const readMin = wordCount ? estimateReadMin(wordCount) : null;
  const revLabel = revision?.revisionNumber ?? deliverable.revisionNumber ?? null;
  const ownerSlug = revision?.agentSlug ?? deliverable.agentSlug ?? null;

  return (
    <header style={{
      background: "var(--cream)",
      padding: "20px 32px 16px",
      borderBottom: "1px solid var(--rule)",
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 24,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <button
          className="body-sm muted"
          style={{ textDecoration: "none", background: "none", border: "none", padding: 0, cursor: "pointer" }}
          onClick={() => setView("home")}
        >
          ← Approvals queue
        </button>
        <h1 className="headline-lg" style={{ margin: "8px 0 0", maxWidth: 760 }}>
          {deliverable.title}
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <span className="badge badge-primary-soft">{deliverable.status}</span>
          {deliverable.type && (
            <span className="badge badge-cream" style={{ fontFamily: "var(--font-mono)" }}>
              {deliverable.type}
            </span>
          )}
          {ownerSlug && (
            <>
              <span className="body-sm muted">·</span>
              <span className="body-sm muted">owner</span>
              <AgentBadge slug={ownerSlug} active />
            </>
          )}
          {(revLabel || wordCount || readMin) && (
            <span className="body-sm muted">
              ·{revLabel ? ` ${revLabel}` : ""}
              {wordCount ? ` · ${wordCount} words` : ""}
              {readMin ? ` · est. ${readMin} min read` : ""}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button className="btn btn-primary" onClick={onApprove}>Approve &amp; ship</button>
        <button className="btn btn-secondary" onClick={onRequestChanges}>Request changes</button>
        <button className="btn btn-ghost" onClick={onReject}>Reject</button>
      </div>
    </header>
  );
}

// ---- MarkdownPreview ----

interface MarkdownPreviewProps {
  deliverable: DeliverableData;
  revision: RevisionData | null;
}

function MarkdownPreview({ deliverable, revision }: MarkdownPreviewProps) {
  return (
    <div style={{ padding: "24px 32px", overflow: "auto" }}>
      <article className="card" style={{ background: "var(--white)", padding: "40px 48px", maxWidth: 720 }}>
        <div className="caption" style={{ marginBottom: 8, color: "var(--ink-3)" }}>
          {`${deliverable.type?.replace(/_/g, " ").toUpperCase() ?? "DRAFT"} · ${deliverable.status.toUpperCase()}`}
        </div>
        <h1 className="headline-lg" style={{ margin: 0 }}>
          {revision?.title ?? deliverable.title}
        </h1>

        <hr className="hr" style={{ margin: "24px 0" }} />

        {revision?.contentMd ? (
          <div>{renderMarkdown(revision.contentMd)}</div>
        ) : (
          <p className="body-md" style={{ color: "var(--ink-3)", fontSize: 15 }}>
            No revision content available yet.
          </p>
        )}
      </article>
    </div>
  );
}

// ---- Thread Tab ----

interface ThreadMessage {
  id?: string;
  who: string;
  name: string;
  time: string;
  text: string;
  active?: boolean;
  isSystem?: boolean;
}

function TMsg({ who, name, time, children, active }: { who: string; name: string; time: string; children: React.ReactNode; active?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <Avatar who={safeAvatarWho(who)} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{name}</span>
          {active != null && <Bulb active={active} />}
          <span className="body-sm muted">{time}</span>
        </div>
        <div className="body-sm" style={{ color: "var(--ink-1)", fontSize: 13, lineHeight: 1.5 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function SysLine({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ paddingLeft: 32, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)" }}>
      · {children}
    </div>
  );
}

function ThreadTab({ deliverableId: _deliverableId }: { deliverableId: string }) {
  // No thread endpoint exists in api.ts for deliverables — show placeholder with static design

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <TMsg who="content-lead" name="Content Lead" time="—" active={true}>
        Thread messages will appear here once the deliverable's activity log is wired to the API.
      </TMsg>
      <SysLine>no thread endpoint available yet</SysLine>
    </div>
  );
}

// ---- Eval Tab ----

interface EvalTabProps {
  evalReport: EvalReport | null;
  revision: RevisionData | null;
}

function EvalTab({ evalReport, revision }: EvalTabProps) {
  // TODO: wire to GET /api/deliverables/:id/eval when endpoint is available
  if (!evalReport) {
    return (
      <div>
        <div className="caption" style={{ marginBottom: 12 }}>
          EVAL · {revision?.revisionNumber ?? "pending"}
        </div>
        <div style={{
          padding: 14,
          background: "var(--white)",
          borderRadius: 6,
          border: "1px solid var(--rule)",
          color: "var(--ink-3)",
          fontSize: 13,
        }}>
          Evaluation pending.
        </div>
      </div>
    );
  }

  const dims = evalReport.dimensions ?? [];
  const revLabel = evalReport.revisionId ?? revision?.revisionNumber ?? "—";
  const timeLabel = evalReport.createdAt
    ? new Date(evalReport.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div>
      <div className="caption" style={{ marginBottom: 12 }}>
        EVAL · {revLabel} · {timeLabel}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {dims.map((s) => (
          <div key={s.dim}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span className="mono" style={{ fontSize: 12 }}>{s.dim}</span>
              <span className="serif" style={{ fontSize: 14 }}>
                {s.score}<span className="muted" style={{ fontSize: 12 }}>/5</span>
              </span>
            </div>
            <div style={{ display: "flex", gap: 3, height: 6 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <div
                  key={n}
                  style={{
                    flex: 1,
                    borderRadius: 1,
                    background: n <= s.score ? "var(--ink-1)" : "rgba(40,38,34,0.10)",
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {evalReport.summary && (
        <div style={{
          marginTop: 22, padding: 14,
          background: "var(--white)", borderRadius: 6,
          border: "1px solid var(--rule)",
        }}>
          <div className="caption" style={{ marginBottom: 8 }}>
            SUMMARY · {evalReport.judgeSlug ?? "eval-judge"}
          </div>
          <p className="body-sm" style={{ color: "var(--ink-1)", fontSize: 13, lineHeight: 1.55, margin: 0 }}>
            {evalReport.summary}
          </p>
        </div>
      )}
    </div>
  );
}

// ---- Revisions Tab ----

interface RevisionEntry {
  id: string;
  revisionNumber?: string;
  agentSlug?: string;
  createdAt?: string;
  note?: string;
}

interface RevisionsTabProps {
  deliverableId: string;
  currentRevisionId: string | null;
  allRevisions: RevisionEntry[];
}

function RevisionsTab({ currentRevisionId, allRevisions }: RevisionsTabProps) {
  // TODO: fetch all revisions from GET /api/deliverables/:id/revisions when available
  if (allRevisions.length === 0) {
    return (
      <div style={{ color: "var(--ink-3)", fontSize: 13 }}>
        No revisions available yet.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {allRevisions.map((r) => {
        const isCurrent = r.id === currentRevisionId;
        const timeLabel = r.createdAt
          ? new Date(r.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
          : "—";

        return (
          <div
            key={r.id}
            className="card"
            style={{
              padding: 12,
              background: isCurrent ? "var(--white)" : "transparent",
              borderColor: isCurrent ? "var(--rule-strong)" : "var(--rule)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
                {r.revisionNumber ?? r.id}
              </div>
              {isCurrent && <span className="badge badge-cream">current</span>}
            </div>
            {r.note && (
              <div className="body-sm" style={{ marginTop: 4 }}>{r.note}</div>
            )}
            <div className="body-sm muted" style={{ marginTop: 4 }}>
              {r.agentSlug ?? "—"} · {timeLabel}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- SidePanel ----

type TabId = "thread" | "eval" | "revisions";

interface SidePanelProps {
  deliverableId: string;
  currentRevisionId: string | null;
  revision: RevisionData | null;
  evalReport: EvalReport | null;
  allRevisions: RevisionEntry[];
}

function SidePanel({ deliverableId, currentRevisionId, revision, evalReport, allRevisions }: SidePanelProps) {
  const [tab, setTab] = useState<TabId>("thread");

  const tabs: { id: TabId; label: string }[] = [
    { id: "thread", label: "Thread" },
    { id: "eval", label: "Eval" },
    { id: "revisions", label: "Revisions" },
  ];

  return (
    <aside style={{
      background: "var(--parchment)",
      borderLeft: "1px solid var(--rule)",
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
    }}>
      <div style={{ display: "flex", borderBottom: "1px solid var(--rule)", padding: "0 12px" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "14px 14px",
              fontSize: 13,
              color: tab === t.id ? "var(--ink-1)" : "var(--ink-3)",
              fontWeight: tab === t.id ? 600 : 500,
              boxShadow: tab === t.id ? "inset 0 -2px 0 var(--ink-1)" : "none",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="scroll" style={{ flex: 1, padding: 18, overflowY: "auto" }}>
        {tab === "thread" && <ThreadTab deliverableId={deliverableId} />}
        {tab === "eval" && <EvalTab evalReport={evalReport} revision={revision} />}
        {tab === "revisions" && (
          <RevisionsTab
            deliverableId={deliverableId}
            currentRevisionId={currentRevisionId}
            allRevisions={allRevisions}
          />
        )}
      </div>
    </aside>
  );
}

// ---- DeliverableView (main export) ----

export function DeliverableView() {
  const { selectedDeliverableId, setView } = useAgencyStore();
  const [deliverable, setDeliverable] = useState<DeliverableData | null>(null);
  const [revision, setRevision] = useState<RevisionData | null>(null);
  const [evalReport] = useState<EvalReport | null>(null);
  const [allRevisions, setAllRevisions] = useState<RevisionEntry[]>([]);

  const refresh = useCallback(() => {
    if (!selectedDeliverableId) return;
    api.deliverables.get(selectedDeliverableId).then((d: DeliverableData) => {
      setDeliverable(d);
      if (d.currentRevisionId) {
        api.deliverables
          .revision(selectedDeliverableId, d.currentRevisionId)
          .then((rev: RevisionData) => {
            setRevision(rev);
            setAllRevisions([rev]);
          })
          .catch(() => setRevision(null));
      }
    }).catch(() => setDeliverable(null));
  }, [selectedDeliverableId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!selectedDeliverableId || !deliverable) {
    return (
      <div style={{ display: "flex", height: "100%", background: "var(--cream)" }}>
        <Sidebar activeNav="home" collapsed />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", fontSize: 14 }}>
          {selectedDeliverableId ? "Loading…" : "Select a deliverable"}
        </main>
      </div>
    );
  }

  function handleApprove() {
    api.approvals.decide(deliverable!.id, "approved").then(refresh).catch(console.error);
  }

  function handleRequestChanges() {
    api.approvals.decide(deliverable!.id, "requested_changes").then(refresh).catch(console.error);
  }

  function handleReject() {
    api.approvals.decide(deliverable!.id, "rejected").then(() => setView("home")).catch(console.error);
  }

  return (
    <div style={{ display: "flex", height: "100%", background: "var(--cream)" }}>
      <Sidebar activeNav="home" collapsed />
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "auto" }}>
        <DeliverableTopBar
          deliverable={deliverable}
          revision={revision}
          onApprove={handleApprove}
          onRequestChanges={handleRequestChanges}
          onReject={handleReject}
        />
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "60% 40%", minHeight: 0 }}>
          <MarkdownPreview deliverable={deliverable} revision={revision} />
          <SidePanel
            deliverableId={deliverable.id}
            currentRevisionId={deliverable.currentRevisionId ?? null}
            revision={revision}
            evalReport={evalReport}
            allRevisions={allRevisions}
          />
        </div>
      </main>
    </div>
  );
}
