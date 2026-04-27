import { useState, useEffect } from "react";
import { Sidebar } from "../components/layout/Sidebar.js";
import { AgentBadge } from "../components/ui/index.js";
import { Bulb } from "../components/ui/Bulb.js";

// ---- Types ----

interface MemoryFile {
  name: string;
  modifiedAt?: string;
  editor?: string;
  editorActive?: boolean;
}

interface MemoryFrontmatter {
  [key: string]: string;
}

interface MemoryCommit {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
  diff?: string;
}

interface MemoryFileContent {
  name: string;
  frontmatter?: MemoryFrontmatter;
  body?: string;
  history?: MemoryCommit[];
}

interface MemoryProposal {
  id: string;
  agent: string;
  file: string;
  summary: string;
}

// ---- Helpers ----

function formatModifiedAt(raw?: string): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

// ---- FileListPanel ----

interface FileListPanelProps {
  files: MemoryFile[];
  selectedFile: string | null;
  onSelect: (name: string) => void;
  proposals: MemoryProposal[];
}

function FileListPanel({ files, selectedFile, onSelect, proposals }: FileListPanelProps) {
  return (
    <aside style={{
      width: 260,
      background: "var(--parchment)",
      borderRight: "1px solid var(--rule)",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ padding: "20px 18px 12px" }}>
        <div className="caption">Memory files</div>
        <div className="body-sm" style={{ marginTop: 2 }}>git-tracked, human-curated</div>
      </div>

      {/* File list */}
      <div>
        {files.map((f) => {
          const isActive = f.name === selectedFile;
          return (
            <button
              key={f.name}
              onClick={() => onSelect(f.name)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 18px",
                background: isActive ? "var(--white)" : "transparent",
                borderLeft: isActive ? "2px solid var(--primary-deep)" : "2px solid transparent",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                border: "none",
                cursor: "pointer",
                borderLeftStyle: "solid",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="mono" style={{ fontSize: 13, color: "var(--ink-1)" }}>{f.name}</span>
              </div>
              <div className="body-sm muted" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                <span>{formatModifiedAt(f.modifiedAt)}</span>
                {f.editor && (
                  <>
                    <span>·</span>
                    {f.editorActive != null && <Bulb active={f.editorActive} />}
                    <span>{f.editor}</span>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Pending proposals */}
      {proposals.length > 0 && (
        <>
          <div style={{ padding: "20px 18px 8px", marginTop: 12, borderTop: "1px solid var(--rule)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="caption">Pending proposals</div>
              <span className="badge badge-primary-soft">{proposals.length}</span>
            </div>
          </div>
          <div style={{ padding: "0 12px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
            {proposals.map((p) => (
              <div
                key={p.id}
                className="card"
                style={{ padding: 10, background: "var(--white)", borderColor: "var(--rule)" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <AgentBadge slug={p.agent} active />
                </div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 4 }}>
                  {p.file}
                </div>
                <div className="body-sm" style={{ fontSize: 12, lineHeight: 1.4 }}>{p.summary}</div>
                <a
                  href="#/memory"
                  style={{
                    display: "inline-block",
                    marginTop: 6,
                    fontSize: 11,
                    color: "var(--primary-deep)",
                    textDecoration: "none",
                  }}
                >
                  View diff →
                </a>
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}

// ---- ReadTab ----

interface ReadTabProps {
  frontmatter: MemoryFrontmatter;
  body: string;
}

function ReadTab({ frontmatter, body }: ReadTabProps) {
  const fmEntries = Object.entries(frontmatter);

  return (
    <div style={{ padding: "24px 32px" }}>
      {/* YAML frontmatter */}
      {fmEntries.length > 0 && (
        <div style={{
          background: "var(--cream)",
          border: "1px solid var(--rule)",
          borderRadius: 6,
          padding: "14px 18px",
          marginBottom: 24,
        }}>
          <div className="caption" style={{ marginBottom: 10 }}>FRONTMATTER · YAML</div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "160px 1fr",
            rowGap: 8,
            columnGap: 16,
          }}>
            {fmEntries.map(([k, v]) => (
              <>
                <div key={`k-${k}`} className="mono" style={{ fontSize: 13, color: "var(--ink-3)" }}>{k}</div>
                <div key={`v-${k}`} className="body-md" style={{ fontSize: 14 }}>{v}</div>
              </>
            ))}
          </div>
        </div>
      )}

      {/* Body */}
      {body && (
        <div className="body-md" style={{ fontSize: 15, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
          {body}
        </div>
      )}

      {!body && fmEntries.length === 0 && (
        <div className="body-sm muted" style={{ fontSize: 13 }}>No content available.</div>
      )}
    </div>
  );
}

// ---- HistoryTab ----

interface HistoryTabProps {
  history: MemoryCommit[];
}

function HistoryTab({ history }: HistoryTabProps) {
  if (history.length === 0) {
    return (
      <div style={{ padding: "24px 32px" }}>
        <div className="body-md muted" style={{ fontSize: 13 }}>No history available.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px" }}>
      <div style={{ marginTop: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {history.map((c) => (
          <div key={c.hash} className="card" style={{ padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                className="mono"
                style={{ fontSize: 12, color: "var(--ink-3)", flexShrink: 0 }}
              >
                {c.hash}
              </span>
              <span className="body-md" style={{ flex: 1, fontSize: 14 }}>{c.message}</span>
              {c.diff && (
                <span className="mono" style={{ fontSize: 11, color: "var(--success-deep)", flexShrink: 0 }}>
                  {c.diff}
                </span>
              )}
            </div>
            <div className="body-sm muted" style={{ marginTop: 4, fontSize: 12 }}>
              {c.author} · {c.timestamp}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- MainContent ----

type TabId = "read" | "history";

interface MainContentProps {
  fileContent: MemoryFileContent | null;
  loading: boolean;
}

function MainContent({ fileContent, loading }: MainContentProps) {
  const [tab, setTab] = useState<TabId>("read");

  if (loading) {
    return (
      <main style={{ flex: 1, minWidth: 0, padding: "28px 32px 32px", overflow: "auto" }}>
        <div className="body-sm muted" style={{ fontSize: 13 }}>Loading…</div>
      </main>
    );
  }

  if (!fileContent) {
    return (
      <main style={{ flex: 1, minWidth: 0, padding: "28px 32px 32px", overflow: "auto" }}>
        <div className="body-sm muted" style={{ fontSize: 13 }}>Select a file to view.</div>
      </main>
    );
  }

  const frontmatter = fileContent.frontmatter ?? {};
  const body = fileContent.body ?? "";
  const history = fileContent.history ?? [];

  const TABS: { id: TabId; label: string }[] = [
    { id: "read", label: "Read" },
    { id: "history", label: "History" },
  ];

  return (
    <main style={{ flex: 1, minWidth: 0, padding: "28px 32px 32px", overflow: "auto" }}>
      <article className="card" style={{ background: "var(--white)", padding: 0, maxWidth: 920 }}>
        {/* File title + status */}
        <div style={{ padding: "24px 32px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1
              className="headline-md"
              style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 22 }}
            >
              {fileContent.name}
            </h1>
            <span className="badge badge-success-soft" style={{ marginLeft: "auto" }}>clean</span>
          </div>

          {/* Tabs */}
          <div style={{
            display: "flex",
            gap: 16,
            marginTop: 14,
            borderBottom: "1px solid var(--rule)",
          }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: "10px 0",
                  fontSize: 13,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: tab === t.id ? "var(--ink-1)" : "var(--ink-3)",
                  fontWeight: tab === t.id ? 600 : 500,
                  boxShadow: tab === t.id ? "inset 0 -2px 0 var(--ink-1)" : "none",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {tab === "read" && <ReadTab frontmatter={frontmatter} body={body} />}
        {tab === "history" && <HistoryTab history={history} />}
      </article>
    </main>
  );
}

// ---- MemoryView (main export) ----

export function MemoryView() {
  const [files, setFiles] = useState<MemoryFile[]>([]);
  const [proposals, setProposals] = useState<MemoryProposal[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<MemoryFileContent | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  // Load file list on mount
  useEffect(() => {
    fetch("/api/memory/files")
      .then((r) => r.json())
      .then((data: MemoryFile[] | { files?: MemoryFile[] }) => {
        const list = Array.isArray(data) ? data : (data.files ?? []);
        setFiles(list);
        if (list.length > 0 && selectedFile === null) {
          setSelectedFile(list[0].name);
        }
      })
      .catch(() => {
        // No API yet — use empty state
        setFiles([]);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load pending proposals
  useEffect(() => {
    fetch("/api/memory-proposals")
      .then((r) => r.json())
      .then((data: Array<{ id: string; agentSessionId?: string; file: string; patch?: string; status?: string }>) => {
        const pending = (Array.isArray(data) ? data : [])
          .filter((p) => !p.status || p.status === "pending")
          .map((p) => ({
            id: p.id,
            agent: p.agentSessionId ?? "agent",
            file: p.file,
            summary: p.patch ? p.patch.split("\n")[0].slice(0, 80) : "Proposed change",
          }));
        setProposals(pending);
      })
      .catch(() => setProposals([]));
  }, []);

  // Load file content when selection changes
  useEffect(() => {
    if (!selectedFile) {
      setFileContent(null);
      return;
    }
    setContentLoading(true);
    fetch(`/api/memory/files/${encodeURIComponent(selectedFile)}`)
      .then((r) => r.json())
      .then((data: MemoryFileContent) => {
        setFileContent(data);
      })
      .catch(() => {
        // Fallback: show file name only
        setFileContent({ name: selectedFile });
      })
      .finally(() => setContentLoading(false));
  }, [selectedFile]);

  return (
    <div style={{
      display: "flex",
      minHeight: "calc(100vh - 36px)",
      background: "var(--cream)",
    }}>
      <Sidebar activeNav="memory" />
      <FileListPanel
        files={files}
        selectedFile={selectedFile}
        onSelect={setSelectedFile}
        proposals={proposals}
      />
      <MainContent fileContent={fileContent} loading={contentLoading} />
    </div>
  );
}
