/* global React */
const { useState, useEffect, useRef, useMemo } = React;

// ---------- Shared atoms ----------

const Bulb = ({ active }) => active
  ? <span className="bulb" aria-label="active" />
  : <span className="bulb-idle" aria-label="idle" />;

const Badge = ({ kind = 'cream', mono, children }) =>
  <span className={`badge badge-${kind}`} style={mono ? { fontFamily: 'var(--font-mono)', letterSpacing: '0.01em' } : null}>{children}</span>;

const AgentBadge = ({ slug, active }) => (
  <span className="badge-agent" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
    {active != null && <Bulb active={active} />}
    {slug}
  </span>
);

const Avatar = ({ who, size }) => {
  const map = {
    human: { i: 'B', cls: 'avatar avatar-human' },
    director: { i: 'Di', cls: 'avatar avatar-director' },
    'content-lead': { i: 'Co', cls: 'avatar avatar-content-lead' },
    'distribution-lead': { i: 'Ds', cls: 'avatar avatar-distribution-lead' },
    'insights-lead': { i: 'In', cls: 'avatar avatar-insights-lead' },
    copywriter: { i: 'Cw', cls: 'avatar avatar-copywriter' },
    'eval-judge': { i: 'Ev', cls: 'avatar avatar-eval-judge' },
    analytics: { i: 'An', cls: 'avatar avatar-analytics' },
  };
  const m = map[who] || { i: '·', cls: 'avatar' };
  return <span className={m.cls + (size === 'md' ? ' avatar-md' : '')}>{m.i}</span>;
};

// ---------- Sidebar ----------

const NAV = [
  { id: 'home', label: 'Home', route: '#/home' },
  { id: 'pipeline', label: 'Pipeline', route: '#/home' },
  { id: 'memory', label: 'Memory', route: '#/memory' },
];

const TEAM = [
  { slug: 'director', name: 'Director', active: true },
  { slug: 'content-lead', name: 'Content Lead', active: true },
  { slug: 'distribution-lead', name: 'Distribution Lead', active: false },
  { slug: 'insights-lead', name: 'Insights Lead', active: false },
  { slug: 'copywriter', name: 'Copywriter', active: true },
  { slug: 'eval-judge', name: 'Eval Judge', active: false },
  { slug: 'analytics', name: 'Analytics', active: false },
];

const Sidebar = ({ activeNav = 'home', collapsed = false }) => {
  if (collapsed) {
    return (
      <aside style={{ width: 56, background: 'var(--parchment)', borderRight: '1px solid var(--rule)',
                       display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', gap: 18 }}>
        <div className="mono" style={{ fontSize: 12, color: 'var(--bulb)', letterSpacing: '0.08em', writingMode: 'vertical-rl', transform: 'rotate(180deg)', marginBottom: 12 }}>MARQUEE</div>
        {NAV.map(n => (
          <div key={n.id} title={n.label} style={{
            width: 32, height: 32, borderRadius: 4, display: 'grid', placeItems: 'center',
            background: n.id === activeNav ? 'var(--primary-soft)' : 'transparent',
            color: n.id === activeNav ? 'var(--primary-deep)' : 'var(--ink-2)',
            fontSize: 11, fontWeight: 600,
          }}>{n.label[0]}</div>
        ))}
        <div style={{ flex: 1 }} />
        {TEAM.filter(t => t.active).map(t => (
          <div key={t.slug} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <Avatar who={t.slug} />
            <Bulb active />
          </div>
        ))}
      </aside>
    );
  }

  return (
    <aside style={{ width: 240, background: 'var(--parchment)', borderRight: '1px solid var(--rule)',
                     display: 'flex', flexDirection: 'column', padding: '20px 0' }}>
      <div style={{ padding: '0 20px 20px', borderBottom: '1px solid var(--rule)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--bulb)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-serif)' }}>m</div>
          <div className="mono" style={{ fontSize: 13, color: 'var(--ink-1)', letterSpacing: '0.12em', fontWeight: 500 }}>
            MARQUEE
          </div>
        </div>
        <div className="body-sm" style={{ marginTop: 6 }}>your little marketing team</div>
      </div>

      <nav style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(n => (
          <a key={n.id} href={n.route} style={{
            padding: '7px 10px', borderRadius: 4, textDecoration: 'none',
            background: n.id === activeNav ? 'var(--primary-soft)' : 'transparent',
            color: n.id === activeNav ? 'var(--primary-deep)' : 'var(--ink-1)',
            fontSize: 14, fontWeight: n.id === activeNav ? 500 : 400,
          }}>{n.label}</a>
        ))}
      </nav>

      <div style={{ padding: '8px 20px 8px', marginTop: 8 }}>
        <div className="caption">Team</div>
      </div>
      <div style={{ padding: '4px 12px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {TEAM.map(t => (
          <div key={t.slug} style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bulb active={t.active} />
            <span style={{ fontSize: 13, color: t.active ? 'var(--ink-1)' : 'var(--ink-3)' }}>{t.name}</span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }} />
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--rule)', fontSize: 12, color: 'var(--ink-3)' }}>
        Stackly · v0.1
      </div>
    </aside>
  );
};

// ---------- Route bar ----------

const ROUTES = [
  { hash: '#/onboarding', label: '01 Onboarding' },
  { hash: '#/home', label: '02 Home' },
  { hash: '#/chat', label: '03 Chat' },
  { hash: '#/deliverable', label: '04 Deliverable' },
  { hash: '#/memory', label: '05 Memory' },
];

const RouteBar = ({ current }) => (
  <div className="route-bar">
    <span className="brand">MARQUEE</span>
    {ROUTES.map(r => (
      <a key={r.hash} href={r.hash} className={current === r.hash ? 'active' : ''}>{r.label}</a>
    ))}
    <div style={{ flex: 1 }} />
    <span style={{ color: 'rgba(239,232,218,0.5)', fontSize: 11 }}>prototype · 1440×900</span>
  </div>
);

Object.assign(window, { Bulb, Badge, AgentBadge, Avatar, Sidebar, RouteBar, TEAM });
