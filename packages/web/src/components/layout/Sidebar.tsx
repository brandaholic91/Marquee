import { useState } from "react";
import { Avatar, type AvatarWho } from "../ui/Avatar.js";
import { Bulb } from "../ui/Bulb.js";
import { useAgencyStore } from "../../store/useAgencyStore.js";

type NavId = "home" | "pipeline" | "memory";

const NAV: { id: NavId; label: string }[] = [
  { id: "home",     label: "Home" },
  { id: "pipeline", label: "Pipeline" },
  { id: "memory",   label: "Memory" },
];

const TEAM: { slug: string; name: string }[] = [
  { slug: "director",          name: "Director" },
  { slug: "content-lead",      name: "Content Lead" },
  { slug: "distribution-lead", name: "Distribution Lead" },
  { slug: "insights-lead",     name: "Insights Lead" },
  { slug: "copywriter",        name: "Copywriter" },
  { slug: "eval-judge",        name: "Eval Judge" },
  { slug: "analytics",         name: "Analytics" },
];

export interface SidebarProps {
  activeNav: NavId;
  collapsed?: boolean;
  activeAgents?: string[];
}

export function Sidebar({ activeNav, collapsed: initialCollapsed = false, activeAgents }: SidebarProps) {
  const setView = useAgencyStore((s) => s.setView);
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function handleNav(id: NavId) {
    if (id === "home" || id === "memory") {
      setView(id);
    }
    // "pipeline" view added in Task 46 (App routing)
  }

  if (collapsed) {
    const visibleTeam = activeAgents
      ? TEAM.filter((t) => activeAgents.includes(t.slug))
      : [];

    return (
      <aside style={{
        width: 56,
        background: "var(--parchment)",
        borderRight: "1px solid var(--rule)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "12px 0 20px",
        gap: 18,
        flexShrink: 0,
      }}>
        <button
          onClick={() => setCollapsed(false)}
          title="Expand sidebar"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 16, padding: "4px 0", lineHeight: 1 }}
        >›</button>
        <div
          className="mono"
          style={{
            fontSize: 12,
            color: "var(--bulb)",
            letterSpacing: "0.08em",
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            marginBottom: 12,
          }}
        >
          MARQUEE
        </div>
        {NAV.map((n) => (
          <div
            key={n.id}
            title={n.label}
            onClick={() => handleNav(n.id)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 4,
              display: "grid",
              placeItems: "center",
              background: n.id === activeNav ? "var(--primary-soft)" : "transparent",
              color: n.id === activeNav ? "var(--primary-deep)" : "var(--ink-2)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {n.label[0]}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        {visibleTeam.map((t) => (
          <div
            key={t.slug}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
          >
            <Avatar who={t.slug as AvatarWho} />
            <Bulb active />
          </div>
        ))}
      </aside>
    );
  }

  return (
    <aside style={{
      width: 240,
      background: "var(--parchment)",
      borderRight: "1px solid var(--rule)",
      display: "flex",
      flexDirection: "column",
      padding: "20px 0",
      flexShrink: 0,
    }}>
      {/* Logo + collapse button */}
      <div style={{ padding: "0 20px 20px", borderBottom: "1px solid var(--rule)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: "var(--bulb)",
            display: "grid",
            placeItems: "center",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "var(--font-serif)",
          }}>
            m
          </div>
          <div
            className="mono"
            style={{ fontSize: 13, color: "var(--ink-1)", letterSpacing: "0.12em", fontWeight: 500 }}
          >
            MARQUEE
          </div>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          title="Collapse sidebar"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 16, padding: "4px 6px", lineHeight: 1, marginTop: -4 }}
        >‹</button>
      </div>
      <div className="body-sm" style={{ padding: "6px 20px 0", color: "var(--ink-3)" }}>your little marketing team</div>

      {/* Nav */}
      <nav style={{ padding: "16px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => handleNav(n.id)}
            style={{
              padding: "7px 10px",
              borderRadius: 4,
              textDecoration: "none",
              background: n.id === activeNav ? "var(--primary-soft)" : "transparent",
              color: n.id === activeNav ? "var(--primary-deep)" : "var(--ink-1)",
              fontSize: 14,
              fontWeight: n.id === activeNav ? 500 : 400,
              textAlign: "left",
            }}
          >
            {n.label}
          </button>
        ))}
      </nav>

      {/* Team section label */}
      <div style={{ padding: "8px 20px 8px", marginTop: 8 }}>
        <div className="caption">Team</div>
      </div>

      {/* Team list */}
      <div style={{ padding: "4px 12px", display: "flex", flexDirection: "column", gap: 1 }}>
        {TEAM.map((t) => {
          const isActive = activeAgents ? activeAgents.includes(t.slug) : false;
          return (
            <div
              key={t.slug}
              style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: 10 }}
            >
              <Bulb active={isActive} />
              <span style={{ fontSize: 13, color: isActive ? "var(--ink-1)" : "var(--ink-3)" }}>
                {t.name}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      {/* Footer */}
      <div style={{
        padding: "12px 20px",
        borderTop: "1px solid var(--rule)",
        fontSize: 12,
        color: "var(--ink-3)",
      }}>
        marquee · v0.1
      </div>
    </aside>
  );
}
