import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Sidebar } from "../components/layout/Sidebar";
import { useBreakpoint } from "../hooks/useBreakpoint";

const ALL_ROLES = [
  { slug: "director",           label: "Director" },
  { slug: "content-lead",       label: "Content Lead" },
  { slug: "distribution-lead",  label: "Distribution Lead" },
  { slug: "insights-lead",      label: "Insights Lead" },
  { slug: "copywriter",         label: "Copywriter" },
  { slug: "social-manager",     label: "Social Manager" },
  { slug: "seo-analyst",        label: "SEO Analyst" },
  { slug: "eval-judge",         label: "Eval Judge" },
  { slug: "paid-specialist",    label: "Paid Specialist" },
  { slug: "repurposer",         label: "Repurposer" },
  { slug: "analytics-analyst",  label: "Analytics Analyst" },
];

interface Skill {
  slug: string;
  name: string;
  agents: string[];
  content: string;
}

const selectStyle = {
  width: "100%", padding: "6px 8px",
  border: "1px solid var(--rule)", borderRadius: 4,
  background: "var(--parchment)", fontSize: 13,
} as const;

function SkillEditor({
  skill,
  onSaved,
  onDeleted,
}: {
  skill: Skill | "new";
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const isNew = skill === "new";
  const [slug, setSlug] = useState(isNew ? "" : (skill as Skill).slug);
  const [content, setContent] = useState(isNew ? "---\nname: \n---\n" : (skill as Skill).content);
  const [agents, setAgents] = useState<string[]>(isNew ? [] : (skill as Skill).agents);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (skill !== "new") {
      setSlug((skill as Skill).slug);
      setContent((skill as Skill).content);
      setAgents((skill as Skill).agents);
      setError(null);
    }
  }, [skill]);

  function toggleAgent(roleSlug: string) {
    setAgents((prev) =>
      prev.includes(roleSlug) ? prev.filter((a) => a !== roleSlug) : [...prev, roleSlug],
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        await api.skills.create(slug, content, agents);
      } else {
        await api.skills.update((skill as Skill).slug, { content, agents });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDeleted || isNew) return;
    await api.skills.delete((skill as Skill).slug).catch(() => {});
    onDeleted();
  }

  return (
    <div style={{ padding: "0 32px", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Slug */}
      <div>
        <label className="caption" style={{ display: "block", marginBottom: 4 }}>Fájlnév (slug)</label>
        <input
          type="text"
          value={slug}
          readOnly={!isNew}
          onChange={(e) => isNew && setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "_"))}
          placeholder="my_skill"
          style={{
            ...selectStyle,
            boxSizing: "border-box",
            background: isNew ? "var(--parchment)" : "var(--surface)",
            color: isNew ? "var(--ink-1)" : "var(--ink-3)",
          }}
        />
      </div>

      {/* Agent checkboxes */}
      <div>
        <label className="caption" style={{ display: "block", marginBottom: 8 }}>Agensek</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px" }}>
          {ALL_ROLES.map((r) => (
            <label key={r.slug} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={agents.includes(r.slug)}
                onChange={() => toggleAgent(r.slug)}
                style={{ cursor: "pointer" }}
              />
              {r.label}
            </label>
          ))}
        </div>
      </div>

      {/* Content editor */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        <label className="caption">Tartalom (Markdown + YAML frontmatter)</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={18}
          style={{
            ...selectStyle,
            resize: "vertical",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            lineHeight: 1.6,
          }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={handleSave}
          disabled={saving || (!isNew && agents.length === 0 && !content)}
          style={{
            padding: "8px 20px", borderRadius: 4, border: "none",
            cursor: saving ? "default" : "pointer",
            background: "var(--bulb)", color: "#fff", fontSize: 13, fontWeight: 500,
          }}
        >
          {saving ? "Mentés…" : "Mentés"}
        </button>
        {!isNew && (
          <button
            onClick={handleDelete}
            style={{
              padding: "8px 14px", borderRadius: 4, border: "1px solid var(--rule)",
              cursor: "pointer", background: "transparent", color: "var(--ink-3)", fontSize: 13,
            }}
          >
            Törlés
          </button>
        )}
        {error && <span style={{ fontSize: 12, color: "red" }}>{error}</span>}
      </div>
    </div>
  );
}

export function SkillsView() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selected, setSelected] = useState<Skill | "new" | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"list" | "editor">("list");
  const { isMobile } = useBreakpoint();

  function loadSkills() {
    (api.skills.list() as Promise<Skill[]>).then(setSkills).catch(console.error);
  }

  useEffect(() => { loadSkills(); }, []);

  function handleSaved() {
    loadSkills();
    setSelected(null);
    if (isMobile) setMobilePanel("list");
  }

  function handleDeleted() {
    loadSkills();
    setSelected(null);
    if (isMobile) setMobilePanel("list");
  }

  function selectSkill(s: Skill | "new") {
    setSelected(s);
    if (isMobile) setMobilePanel("editor");
  }

  const skillList = (
    <div style={{ width: isMobile ? "100%" : 240, flexShrink: 0, borderRight: isMobile ? "none" : "1px solid var(--rule)", overflowY: "auto" }}>
      {skills.length === 0 && (
        <div style={{ padding: "16px 20px", fontSize: 13, color: "var(--ink-3)" }}>Még nincs skill.</div>
      )}
      {skills.map((s) => (
        <button
          key={s.slug}
          onClick={() => selectSkill(s)}
          style={{
            display: "block", width: "100%", textAlign: "left",
            padding: "10px 20px", border: "none", borderBottom: "1px solid var(--rule)",
            background: selected !== "new" && (selected as Skill | null)?.slug === s.slug
              ? "var(--primary-soft)" : "transparent",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-1)", marginBottom: 3 }}>
            {s.name}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
            {s.slug}
          </div>
          <div style={{ marginTop: 5, display: "flex", flexWrap: "wrap", gap: 3 }}>
            {s.agents.map((a) => (
              <span key={a} style={{
                fontSize: 10, padding: "1px 6px", borderRadius: 3,
                background: "var(--primary-soft)", color: "var(--primary-deep)",
              }}>
                {a}
              </span>
            ))}
          </div>
        </button>
      ))}
    </div>
  );

  const editor = (
    <div style={{ flex: 1, overflowY: "auto", paddingBottom: 32 }}>
      {isMobile && (
        <button
          onClick={() => setMobilePanel("list")}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            background: "none", border: "none", cursor: "pointer",
            color: "var(--ink-3)", fontSize: 13, padding: "8px 16px",
            marginBottom: 4,
          }}
        >
          ← Skillek
        </button>
      )}
      {selected === null && (
        <div style={{ padding: "40px 32px", fontSize: 13, color: "var(--ink-3)" }}>
          Válassz egy skillt szerkesztéshez, vagy kattints a "+ Új skill" gombra újat létrehozni.
        </div>
      )}
      {selected !== null && (
        <div style={{ paddingTop: 8 }}>
          <SkillEditor
            key={selected === "new" ? "new" : (selected as Skill).slug}
            skill={selected}
            onSaved={handleSaved}
            onDeleted={selected !== "new" ? handleDeleted : undefined}
          />
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar activeNav="skills" />
      <main style={{ flex: 1, padding: isMobile ? "20px 0 88px" : "28px 0", overflow: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: `0 ${isMobile ? 16 : 32}px`, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 className="heading">Skillek</h1>
          <button
            onClick={() => selectSkill("new")}
            style={{
              padding: "7px 16px", borderRadius: 4, border: "none",
              cursor: "pointer", background: "var(--bulb)", color: "#fff", fontSize: 13,
            }}
          >
            + Új skill
          </button>
        </div>

        {isMobile ? (
          <div style={{ flex: 1, overflow: "hidden" }}>
            {mobilePanel === "list" ? skillList : editor}
          </div>
        ) : (
          <div style={{ display: "flex", flex: 1, gap: 0, overflow: "hidden" }}>
            {skillList}
            {editor}
          </div>
        )}
      </main>
    </div>
  );
}
