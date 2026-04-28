import { useState, useEffect, Fragment } from "react";
import { api } from "../lib/api.js";
import { Sidebar } from "../components/layout/Sidebar.js";
import { AgentBadge } from "../components/ui/index.js";
import { Bulb } from "../components/ui/Bulb.js";
import { useBreakpoint } from "../hooks/useBreakpoint.js";

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
  onCreateFile: () => void;
  fullWidth?: boolean;
}

function FileListPanel({ files, selectedFile, onSelect, proposals, onCreateFile, fullWidth }: FileListPanelProps) {
  const [newFileName, setNewFileName] = useState("");
  const [showNew, setShowNew] = useState(false);

  async function handleCreate() {
    if (!newFileName.trim()) return;
    const name = newFileName.endsWith(".md") ? newFileName : `${newFileName}.md`;
    await api.memory.create(name);
    setShowNew(false);
    setNewFileName("");
    onCreateFile();
  }

  return (
    <aside style={{
      width: fullWidth ? "100%" : 260,
      flex: fullWidth ? 1 : undefined,
      background: "var(--parchment)",
      borderRight: fullWidth ? "none" : "1px solid var(--rule)",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      minWidth: 0,
    }}>
      {/* Header */}
      <div style={{ padding: "20px 18px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="caption">Memóriafájlok</div>
          <button
            onClick={() => setShowNew(true)}
            style={{ fontSize: 12, padding: "3px 10px", borderRadius: 4, border: "1px solid var(--rule)", background: "transparent", cursor: "pointer", color: "var(--ink-2)" }}
          >
            + Új fájl
          </button>
        </div>
        <div className="body-sm" style={{ marginTop: 2 }}>git-követett, ember által szerkesztett</div>
        {showNew && (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              autoFocus
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="filename.md"
              style={{ flex: 1, padding: "5px 8px", border: "1px solid var(--rule)", borderRadius: 4, fontSize: 13 }}
            />
            <button onClick={handleCreate} style={{ padding: "5px 12px", borderRadius: 4, background: "var(--bulb)", color: "#fff", border: "none", cursor: "pointer", fontSize: 13 }}>Létrehozás</button>
            <button onClick={() => setShowNew(false)} style={{ padding: "5px 12px", borderRadius: 4, background: "transparent", color: "var(--ink-3)", border: "1px solid var(--rule)", cursor: "pointer", fontSize: 13 }}>Mégse</button>
          </div>
        )}
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
              <div className="caption">Függő javaslatok</div>
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
                  Diff megtekintése →
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
              <Fragment key={k}>
                <div className="mono" style={{ fontSize: 13, color: "var(--ink-3)" }}>{k}</div>
                <div className="body-md" style={{ fontSize: 14 }}>{v}</div>
              </Fragment>
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
        <div className="body-sm muted" style={{ fontSize: 13 }}>Nincs elérhető tartalom.</div>
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
        <div className="body-md muted" style={{ fontSize: 13 }}>Nincs elérhető előzmény.</div>
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
  selectedFile: string | null;
  onSaved: () => void;
  onBack?: () => void;
}

function MainContent({ fileContent, loading, selectedFile, onSaved, onBack }: MainContentProps) {
  const [tab, setTab] = useState<TabId>("read");
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset edit state when selected file changes
  useEffect(() => {
    setEditing(false);
    setEditContent("");
    setSaving(false);
  }, [selectedFile]);

  function handleEditClick() {
    // Build raw file content: frontmatter + body
    if (!fileContent) return;
    const fm = fileContent.frontmatter ?? {};
    const fmEntries = Object.entries(fm);
    let raw = "";
    if (fmEntries.length > 0) {
      raw += "---\n";
      for (const [k, v] of fmEntries) {
        raw += `${k}: ${v}\n`;
      }
      raw += "---\n\n";
    }
    raw += fileContent.body ?? "";
    setEditContent(raw);
    setEditing(true);
  }

  function handleCancel() {
    setEditing(false);
    setEditContent("");
  }

  function handleSave() {
    if (!selectedFile || saving) return;
    const filename = selectedFile.endsWith(".md") ? selectedFile : `${selectedFile}.md`;
    setSaving(true);
    api.memory.put(filename, editContent)
      .then(() => {
        setSaving(false);
        setEditing(false);
        setEditContent("");
        onSaved();
      })
      .catch(() => {
        setSaving(false);
      });
  }

  const backBtn = onBack ? (
    <button
      onClick={onBack}
      style={{
        display: "flex", alignItems: "center", gap: 4,
        background: "none", border: "none", cursor: "pointer",
        color: "var(--ink-3)", fontSize: 13, padding: 0,
        marginBottom: 16,
      }}
    >
      ← Fájlok
    </button>
  ) : null;

  if (loading) {
    return (
      <main style={{ flex: 1, minWidth: 0, padding: "28px 32px 32px", overflow: "auto" }}>
        {backBtn}
        <div className="body-sm muted" style={{ fontSize: 13 }}>Betöltés…</div>
      </main>
    );
  }

  if (!fileContent) {
    return (
      <main style={{ flex: 1, minWidth: 0, padding: "28px 32px 32px", overflow: "auto" }}>
        {backBtn}
        <div className="body-sm muted" style={{ fontSize: 13 }}>Válassz egy fájlt a megtekintéshez.</div>
      </main>
    );
  }

  const frontmatter = fileContent.frontmatter ?? {};
  const body = fileContent.body ?? "";
  const history = fileContent.history ?? [];

  const TABS: { id: TabId; label: string }[] = [
    { id: "read", label: "Olvasás" },
    { id: "history", label: "Előzmények" },
  ];

  return (
    <main style={{ flex: 1, minWidth: 0, padding: "28px 32px 32px", overflow: "auto" }}>
      {backBtn}
      <article className="card" style={{ background: "var(--white)", padding: 0, maxWidth: 920 }}>
        {/* File title + status + edit button */}
        <div style={{ padding: "24px 32px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1
              className="headline-md"
              style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 22 }}
            >
              {fileContent.name}
            </h1>
            <span className="badge badge-success-soft" style={{ marginLeft: "auto" }}>clean</span>
            {!editing && (
              <button
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: "4px 12px" }}
                onClick={handleEditClick}
              >
                Szerkesztés
              </button>
            )}
          </div>

          {/* Tabs (hidden while editing) */}
          {!editing && (
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
          )}
        </div>

        {/* Inline editor */}
        {editing ? (
          <div style={{ padding: "24px 32px" }}>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              style={{
                width: "100%",
                minHeight: 300,
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                lineHeight: 1.6,
                padding: "12px 14px",
                border: "1px solid var(--rule)",
                borderRadius: 6,
                background: "var(--cream)",
                color: "var(--ink-1)",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                className="btn btn-primary"
                style={{ fontSize: 13 }}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Mentés…" : "Mentés"}
              </button>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 13 }}
                onClick={handleCancel}
                disabled={saving}
              >
                Mégse
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Tab content */}
            {tab === "read" && <ReadTab frontmatter={frontmatter} body={body} />}
            {tab === "history" && <HistoryTab history={history} />}
          </>
        )}
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
  const [mobilePanel, setMobilePanel] = useState<"files" | "content">("files");
  const { isMobile } = useBreakpoint();

  // Load file list function (called on mount and after file creation)
  function loadFiles() {
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
  }

  // Load file list on mount
  useEffect(() => {
    loadFiles();
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

  // Load file content when selection changes (also called after a save)
  const [contentVersion, setContentVersion] = useState(0);

  useEffect(() => {
    if (!selectedFile) { setFileContent(null); return; }
    setContentLoading(true);
    const controller = new AbortController();
    const filename = selectedFile.endsWith(".md") ? selectedFile : `${selectedFile}.md`;
    api.memory.get(filename)
      .then((data: MemoryFileContent) => {
        if (controller.signal.aborted) return;
        setFileContent(data);
        setContentLoading(false);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError" || controller.signal.aborted) return;
        setFileContent({ name: selectedFile } as MemoryFileContent);
        setContentLoading(false);
      });
    return () => controller.abort();
  // contentVersion triggers a reload after save
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile, contentVersion]);

  function handleSaved() {
    setContentVersion((v) => v + 1);
  }

  function handleFileSelect(name: string) {
    setSelectedFile(name);
    if (isMobile) setMobilePanel("content");
  }

  return (
    <div style={{
      display: "flex",
      height: "100%",
      background: "var(--cream)",
    }}>
      <Sidebar activeNav="memory" />
      {isMobile ? (
        mobilePanel === "files" ? (
          <FileListPanel
            files={files}
            selectedFile={selectedFile}
            onSelect={handleFileSelect}
            proposals={proposals}
            onCreateFile={loadFiles}
            fullWidth
          />
        ) : (
          <MainContent
            fileContent={fileContent}
            loading={contentLoading}
            selectedFile={selectedFile}
            onSaved={handleSaved}
            onBack={() => setMobilePanel("files")}
          />
        )
      ) : (
        <>
          <FileListPanel
            files={files}
            selectedFile={selectedFile}
            onSelect={setSelectedFile}
            proposals={proposals}
            onCreateFile={loadFiles}
          />
          <MainContent
            fileContent={fileContent}
            loading={contentLoading}
            selectedFile={selectedFile}
            onSaved={handleSaved}
          />
        </>
      )}
    </div>
  );
}
