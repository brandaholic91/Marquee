import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Sidebar } from "../components/layout/Sidebar";
import { useBreakpoint } from "../hooks/useBreakpoint";

const TEAM = [
  { slug: "director",          name: "Director" },
  { slug: "content-lead",      name: "Content Lead" },
  { slug: "distribution-lead", name: "Distribution Lead" },
  { slug: "insights-lead",     name: "Insights Lead" },
  { slug: "copywriter",        name: "Copywriter" },
  { slug: "social-manager",    name: "Social Manager" },
  { slug: "seo-analyst",       name: "SEO Analyst" },
  { slug: "eval-judge",        name: "Eval Judge" },
];

interface AgentConfig {
  style?: string;
  tone?: string;
  response_length?: string;
  language?: string;
  model?: string;
  thinking_level?: string;
  system_prompt_override?: string;
}

function ConfigPanel({ role, isMobile = false }: { role: string; isMobile?: boolean }) {
  const [config, setConfig] = useState<AgentConfig>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.agents.getConfig(role).then((data: { config: AgentConfig } | null) => {
      if (data) setConfig(data.config);
      else setConfig({});
    }).catch(() => setConfig({}));
  }, [role]);

  async function handleSave() {
    setSaving(true);
    try {
      await api.agents.putConfig(role, config as Record<string, unknown>);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const preview = [
    config.style && `Style: ${config.style}`,
    config.tone && `Tone: ${config.tone}`,
    config.response_length && `Response length: ${config.response_length}`,
  ].filter(Boolean).join(" | ");

  return (
    <div style={{ padding: `0 ${isMobile ? 16 : 32}px` }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 24 }}>
        {/* Structured fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="caption" style={{ display: "block", marginBottom: 4 }}>Style</label>
            <select
              value={config.style ?? ""}
              onChange={(e) => setConfig({ ...config, style: e.target.value || undefined })}
              style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 4, background: "var(--parchment)", fontSize: 13 }}
            >
              <option value="">— not set —</option>
              <option value="terse">Terse</option>
              <option value="balanced">Balanced</option>
              <option value="verbose">Verbose</option>
            </select>
          </div>
          <div>
            <label className="caption" style={{ display: "block", marginBottom: 4 }}>Tone</label>
            <select
              value={config.tone ?? ""}
              onChange={(e) => setConfig({ ...config, tone: e.target.value || undefined })}
              style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 4, background: "var(--parchment)", fontSize: 13 }}
            >
              <option value="">— not set —</option>
              <option value="authoritative">Authoritative</option>
              <option value="friendly">Friendly</option>
              <option value="neutral">Neutral</option>
            </select>
          </div>
          <div>
            <label className="caption" style={{ display: "block", marginBottom: 4 }}>Response length</label>
            <select
              value={config.response_length ?? ""}
              onChange={(e) => setConfig({ ...config, response_length: e.target.value || undefined })}
              style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 4, background: "var(--parchment)", fontSize: 13 }}
            >
              <option value="">— not set —</option>
              <option value="concise">Concise</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>
          <div>
            <label className="caption" style={{ display: "block", marginBottom: 4 }}>
              Model{" "}
              <span style={{ color: "var(--ink-3)", fontWeight: 400, fontSize: 11 }}>
                (openai-subscription only)
              </span>
            </label>
            <select
              value={config.model ?? ""}
              onChange={(e) => setConfig({ ...config, model: e.target.value || undefined })}
              style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 4, background: "var(--parchment)", fontSize: 13 }}
            >
              <option value="">— not set (use default) —</option>
              <option value="gpt-5.4-mini">gpt-5.4-mini (fast)</option>
              <option value="gpt-5.4">gpt-5.4 (balanced)</option>
              <option value="gpt-5.5">gpt-5.5 (powerful)</option>
              <option value="gpt-5.2">gpt-5.2</option>
            </select>
          </div>
          <div>
            <label className="caption" style={{ display: "block", marginBottom: 4 }}>Thinking level</label>
            <select
              value={config.thinking_level ?? "off"}
              onChange={(e) => setConfig({ ...config, thinking_level: e.target.value === "off" ? undefined : e.target.value })}
              style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 4, background: "var(--parchment)", fontSize: 13 }}
            >
              <option value="off">Off</option>
              <option value="minimal">Minimal</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          {preview && (
            <div style={{ padding: "8px 10px", background: "var(--surface)", borderRadius: 4, fontSize: 12, color: "var(--ink-2)", fontFamily: "var(--font-mono)" }}>
              {preview}
            </div>
          )}
        </div>

        {/* Freeform override */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label className="caption">System prompt override (appended)</label>
          <textarea
            value={config.system_prompt_override ?? ""}
            onChange={(e) => setConfig({ ...config, system_prompt_override: e.target.value || undefined })}
            rows={10}
            style={{ padding: "8px 10px", border: "1px solid var(--rule)", borderRadius: 4, background: "var(--parchment)", fontSize: 13, resize: "vertical", fontFamily: "var(--font-mono)" }}
          />
        </div>
      </div>

      <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "8px 20px", borderRadius: 4, border: "none", cursor: saving ? "default" : "pointer",
            background: saved ? "var(--success, #22c55e)" : "var(--bulb)", color: "#fff", fontSize: 13, fontWeight: 500,
          }}
        >
          {saving ? "Saving…" : saved ? "Saved!" : "Save & restart agent"}
        </button>
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
          A mentés újraindítja az agentet — a meglévő kontextusa elvész.
        </span>
      </div>
    </div>
  );
}

export function AgentsView() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"list" | "config">("list");
  const { isMobile } = useBreakpoint();

  function selectRole(slug: string) {
    setSelectedRole(slug);
    if (isMobile) setMobilePanel("config");
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar activeNav="agents" />
      <main style={{ flex: 1, padding: isMobile ? "20px 0 88px" : "28px 0", overflow: "auto" }}>
        <h1 className="heading" style={{ padding: `0 ${isMobile ? 16 : 32}px`, marginBottom: 24 }}>Agents</h1>

        {isMobile ? (
          mobilePanel === "list" ? (
            <div>
              {TEAM.map((t) => (
                <button
                  key={t.slug}
                  onClick={() => selectRole(t.slug)}
                  style={{
                    display: "flex", width: "100%", textAlign: "left",
                    padding: "12px 16px", border: "none", borderBottom: "1px solid var(--rule)",
                    background: "transparent",
                    color: "var(--ink-1)", fontSize: 14, cursor: "pointer",
                    justifyContent: "space-between", alignItems: "center",
                  }}
                >
                  <span>{t.name}</span>
                  <span style={{ color: "var(--ink-3)" }}>›</span>
                </button>
              ))}
            </div>
          ) : (
            <div>
              <button
                onClick={() => setMobilePanel("list")}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--ink-3)", fontSize: 13, padding: "0 16px",
                  marginBottom: 12,
                }}
              >
                ← Agents
              </button>
              <div style={{ padding: "0 0 12px 16px", fontWeight: 600, fontSize: 15, color: "var(--ink-1)" }}>
                {TEAM.find((t) => t.slug === selectedRole)?.name}
              </div>
              {selectedRole && <ConfigPanel key={selectedRole} role={selectedRole} isMobile />}
            </div>
          )
        ) : (
          <div style={{ display: "flex", gap: 0 }}>
            {/* Team list */}
            <div style={{ width: 200, flexShrink: 0, borderRight: "1px solid var(--rule)" }}>
              {TEAM.map((t) => (
                <button
                  key={t.slug}
                  onClick={() => setSelectedRole(t.slug)}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "9px 20px", border: "none", background: selectedRole === t.slug ? "var(--primary-soft)" : "transparent",
                    color: selectedRole === t.slug ? "var(--primary-deep)" : "var(--ink-1)",
                    fontSize: 13, cursor: "pointer",
                  }}
                >
                  {t.name}
                </button>
              ))}
            </div>

            {/* Config panel */}
            <div style={{ flex: 1 }}>
              {selectedRole
                ? <ConfigPanel key={selectedRole} role={selectedRole} />
                : <div style={{ padding: "40px 32px", color: "var(--ink-3)", fontSize: 13 }}>Select an agent to configure</div>
              }
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
