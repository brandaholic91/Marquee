import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Sidebar } from "../components/layout/Sidebar";
import { useBreakpoint } from "../hooks/useBreakpoint";

const TEAM = [
  { slug: "director",          name: "Director" },
  { slug: "content-lead",      name: "Content Lead" },
  { slug: "copywriter",        name: "Copywriter" },
  { slug: "repurposer",        name: "Repurposer" },
  { slug: "distribution-lead", name: "Distribution Lead" },
  { slug: "social-manager",    name: "Social Manager" },
  { slug: "paid-specialist",   name: "Paid Specialist" },
  { slug: "insights-lead",     name: "Insights Lead" },
  { slug: "seo-analyst",       name: "SEO Analyst" },
  { slug: "analytics-analyst", name: "Analytics Analyst" },
  { slug: "eval-judge",        name: "Eval Judge" },
];

interface AgentConfig {
  style?: string;
  tone?: string;
  response_length?: string;
  language?: string;
  model?: string;
  thinking_level?: string;
  identity?: string;
}

function ConfigPanel({ role, isMobile = false }: { role: string; isMobile?: boolean }) {
  const [config, setConfig] = useState<AgentConfig>({});
  const [identity, setIdentity] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.agents.getConfig(role).then((data: { config: AgentConfig } | null) => {
      if (data?.config) setConfig(data.config);
      else setConfig({});
    }).catch(() => setConfig({}));
    api.agents.getIdentity(role).then((data) => setIdentity(data.identity)).catch(() => {});
  }, [role]);

  async function handleSave() {
    setSaving(true);
    try {
      await Promise.all([
        api.agents.putConfig(role, config as Record<string, unknown>),
        api.agents.putIdentity(role, identity),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const preview = [
    config.style && `Stílus: ${config.style}`,
    config.tone && `Hang: ${config.tone}`,
    config.response_length && `Válasz hossza: ${config.response_length}`,
  ].filter(Boolean).join(" | ");

  return (
    <div style={{ padding: `0 ${isMobile ? 16 : 32}px` }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 24 }}>
        {/* Structured fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="caption" style={{ display: "block", marginBottom: 4 }}>Stílus</label>
            <select
              value={config.style ?? ""}
              onChange={(e) => setConfig({ ...config, style: e.target.value || undefined })}
              style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 4, background: "var(--parchment)", fontSize: 13 }}
            >
              <option value="">— nincs beállítva —</option>
              <option value="terse">Tömör</option>
              <option value="balanced">Kiegyensúlyozott</option>
              <option value="verbose">Részletes</option>
            </select>
          </div>
          <div>
            <label className="caption" style={{ display: "block", marginBottom: 4 }}>Hang</label>
            <select
              value={config.tone ?? ""}
              onChange={(e) => setConfig({ ...config, tone: e.target.value || undefined })}
              style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 4, background: "var(--parchment)", fontSize: 13 }}
            >
              <option value="">— nincs beállítva —</option>
              <option value="authoritative">Tekintélyes</option>
              <option value="friendly">Barátságos</option>
              <option value="neutral">Semleges</option>
            </select>
          </div>
          <div>
            <label className="caption" style={{ display: "block", marginBottom: 4 }}>Válasz hossza</label>
            <select
              value={config.response_length ?? ""}
              onChange={(e) => setConfig({ ...config, response_length: e.target.value || undefined })}
              style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 4, background: "var(--parchment)", fontSize: 13 }}
            >
              <option value="">— nincs beállítva —</option>
              <option value="concise">Rövid</option>
              <option value="detailed">Részletes</option>
            </select>
          </div>
          <div>
            <label className="caption" style={{ display: "block", marginBottom: 4 }}>
              Modell{" "}
              <span style={{ color: "var(--ink-3)", fontWeight: 400, fontSize: 11 }}>
                (csak openai-előfizetéssel)
              </span>
            </label>
            <select
              value={config.model ?? ""}
              onChange={(e) => setConfig({ ...config, model: e.target.value || undefined })}
              style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 4, background: "var(--parchment)", fontSize: 13 }}
            >
              <option value="">— nincs beállítva (alapértelmezett) —</option>
              <option value="gpt-5.4-mini">gpt-5.4-mini (fast)</option>
              <option value="gpt-5.4">gpt-5.4 (balanced)</option>
              <option value="gpt-5.5">gpt-5.5 (powerful)</option>
              <option value="gpt-5.2">gpt-5.2</option>
            </select>
          </div>
          <div>
            <label className="caption" style={{ display: "block", marginBottom: 4 }}>Gondolkodási szint</label>
            <select
              value={config.thinking_level ?? "off"}
              onChange={(e) => setConfig({ ...config, thinking_level: e.target.value === "off" ? undefined : e.target.value })}
              style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 4, background: "var(--parchment)", fontSize: 13 }}
            >
              <option value="off">Ki</option>
              <option value="minimal">Minimális</option>
              <option value="low">Alacsony</option>
              <option value="medium">Közepes</option>
              <option value="high">Magas</option>
            </select>
          </div>
          {preview && (
            <div style={{ padding: "8px 10px", background: "var(--surface)", borderRadius: 4, fontSize: 12, color: "var(--ink-2)", fontFamily: "var(--font-mono)" }}>
              {preview}
            </div>
          )}
        </div>

        {/* Identity */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label className="caption">Identitás</label>
          <textarea
            value={identity}
            onChange={(e) => setIdentity(e.target.value)}
            placeholder={`Te vagy a [szerepkör] agentje ennek az AI marketing ügynökségnek.\n\nÍrd le az agent szerepét, feladatait, döntéshozatali stílusát és kapcsolatát a többi agenthez.`}
            rows={12}
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
          {saving ? "Mentés…" : saved ? "Mentve!" : "Mentés & agent újraindítása"}
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
        <h1 className="heading" style={{ padding: `0 ${isMobile ? 16 : 32}px`, marginBottom: 24 }}>Agensek</h1>

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
                ← Agensek
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
                : <div style={{ padding: "40px 32px", color: "var(--ink-3)", fontSize: 13 }}>Válassz egy agentet a beállításhoz</div>
              }
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
