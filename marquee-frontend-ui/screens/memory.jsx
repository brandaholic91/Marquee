/* global React */
const { useState: useStateMem } = React;

const MemoryScreen = () => {
  const [active, setActive] = useStateMem('client_profile.md');
  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 36px)', background: 'var(--cream)' }}>
      <Sidebar activeNav="memory" />
      <FileList active={active} setActive={setActive} />
      <main style={{ flex: 1, minWidth: 0, padding: '28px 32px 32px', overflow: 'auto' }}>
        <MemoryFile />
      </main>
    </div>
  );
};

const FILES = [
  { name: 'client_profile.md',    modified: '14:02', editor: 'director', editorActive: true },
  { name: 'brand_guidelines.md',  modified: 'Apr 24', editor: 'you', editorActive: false },
  { name: 'ongoing_campaigns.md', modified: '13:51', editor: 'content-lead', editorActive: true },
  { name: 'content_history.md',   modified: 'Apr 22', editor: 'analytics', editorActive: false },
];

const PROPOSALS = [
  { agent: 'content-lead', file: 'ongoing_campaigns.md', summary: '+ Q2 PLG dashboard education series' },
  { agent: 'copywriter',   file: 'brand_guidelines.md',  summary: '~ tighten "non-promotional" examples' },
];

const FileList = ({ active, setActive }) => (
  <aside style={{ width: 260, background: 'var(--parchment)', borderRight: '1px solid var(--rule)',
                  display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: '20px 18px 12px' }}>
      <div className="caption">Memory files</div>
      <div className="body-sm" style={{ marginTop: 2 }}>git-tracked, human-curated</div>
    </div>
    <div>
      {FILES.map(f => (
        <button key={f.name} onClick={() => setActive(f.name)} style={{
          width: '100%', textAlign: 'left', padding: '10px 18px',
          background: active === f.name ? 'var(--white)' : 'transparent',
          borderLeft: active === f.name ? '2px solid var(--primary)' : '2px solid transparent',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="mono" style={{ fontSize: 13, color: 'var(--ink-1)' }}>{f.name}</span>
          </div>
          <div className="body-sm muted" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span>{f.modified}</span>
            <span>·</span>
            {f.editorActive && <Bulb active />}
            <span>{f.editor}</span>
          </div>
        </button>
      ))}
    </div>

    <div style={{ padding: '20px 18px 8px', marginTop: 12, borderTop: '1px solid var(--rule)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="caption">Pending proposals</div>
        <span className="badge badge-primary-soft">2</span>
      </div>
    </div>
    <div style={{ padding: '0 12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {PROPOSALS.map(p => (
        <div key={p.summary} className="card" style={{ padding: 10, background: 'var(--white)', borderColor: 'var(--rule)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <AgentBadge slug={p.agent} active />
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>{p.file}</div>
          <div className="body-sm" style={{ fontSize: 12, lineHeight: 1.4 }}>{p.summary}</div>
          <a href="#/chat" style={{ display: 'inline-block', marginTop: 6, fontSize: 11, color: 'var(--primary-deep)', textDecoration: 'none' }}>
            View diff →
          </a>
        </div>
      ))}
    </div>
  </aside>
);

const MemoryFile = () => {
  const [tab, setTab] = useStateMem('read');
  return (
    <article className="card" style={{ background: 'var(--white)', padding: 0, maxWidth: 920 }}>
      <div style={{ padding: '24px 32px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h1 className="headline-md" style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 22 }}>
            client_profile.md
          </h1>
          <span className="badge badge-success-soft" style={{ marginLeft: 'auto' }}>clean</span>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 14, borderBottom: '1px solid var(--rule)' }}>
          {[{ id: 'read', label: 'Read' }, { id: 'history', label: 'History' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '10px 0', fontSize: 13,
              color: tab === t.id ? 'var(--ink-1)' : 'var(--ink-3)',
              fontWeight: tab === t.id ? 600 : 500,
              boxShadow: tab === t.id ? 'inset 0 -2px 0 var(--ink-1)' : 'none',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {tab === 'read' && <ReadTab />}
      {tab === 'history' && <HistoryTab />}

      <div style={{ padding: '20px 32px 28px', borderTop: '1px solid var(--rule)', background: 'var(--cream)',
                    borderRadius: '0 0 6px 6px' }}>
        <div className="caption" style={{ marginBottom: 10 }}>git log · last 3</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { hash: 'a4c2f01', who: 'director',     when: '14:02 today',   msg: 'add icp + competitors from onboarding' },
            { hash: '3d8e1b2', who: 'you',          when: '09:18 today',   msg: 'tighten brand_voice' },
            { hash: '7f1a9c4', who: 'content-lead', when: 'Apr 24 16:40',  msg: 'append Q1 retrospective notes' },
          ].map(c => (
            <div key={c.hash} style={{ display: 'grid', gridTemplateColumns: '90px 1fr auto', gap: 14, alignItems: 'baseline' }}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{c.hash}</span>
              <span className="body-sm" style={{ fontSize: 13 }}>{c.msg}</span>
              <span className="body-sm muted" style={{ fontSize: 12 }}>{c.who} · {c.when}</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
};

const ReadTab = () => (
  <div style={{ padding: '24px 32px' }}>
    {/* YAML frontmatter as table */}
    <div style={{ background: 'var(--cream)', border: '1px solid var(--rule)', borderRadius: 6,
                  padding: '14px 18px', marginBottom: 24 }}>
      <div className="caption" style={{ marginBottom: 10 }}>FRONTMATTER · YAML</div>
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: 8, columnGap: 16 }}>
        {[
          ['client_name', 'Stackly'],
          ['icp', '10–100 employee SaaS, PLG growth motion, growth teams of 2–10'],
          ['usp', '"the dashboard built for PLG"'],
          ['competitors', 'Databox, Geckoboard, Klipfolio'],
          ['brand_voice', 'data-driven, tight, non-promotional'],
          ['trigger_event', 'activation plateau'],
        ].map(([k, v]) => (
          <React.Fragment key={k}>
            <div className="mono" style={{ fontSize: 13, color: 'var(--ink-3)' }}>{k}</div>
            <div className="body-md" style={{ fontSize: 14 }}>{v}</div>
          </React.Fragment>
        ))}
      </div>
    </div>

    <p className="body-md" style={{ fontSize: 16, lineHeight: 1.7 }}>
      Stackly sells a dashboard product to growth teams that have outgrown spreadsheet-based reporting but
      can't justify the price tag (or the implementation cost) of an enterprise BI tool. The product's
      distinctive bet is that PLG companies need a different shape of dashboard than top-down sales orgs —
      shorter feedback loops, instrument-first, designed around <em>self-serve trial cohorts</em> rather than
      named accounts.
    </p>

    <h2 className="headline-md" style={{ margin: '26px 0 10px', fontSize: 20 }}>Buying motion</h2>
    <p className="body-md" style={{ fontSize: 16, lineHeight: 1.7 }}>
      The buyer is almost always the head of growth or a senior PMM, not the founder. The trigger event is
      consistent across customer interviews: activation rate stops moving for 4–6 weeks and the founder asks
      where the funnel is leaking. The buying team is small (1–3 people) and the evaluation period is short
      (10–14 days). Stackly wins evaluations on time-to-first-chart, not on feature breadth.
    </p>

    <p className="body-md" style={{ fontSize: 16, lineHeight: 1.7 }}>
      Brand voice should reflect this audience. They have read the Reforge essays. They know the Mixpanel
      reference architecture. Don't explain what activation is. Don't open with a thesis statement. Open
      with a number, a quote, or a teardown.
    </p>
  </div>
);

const HistoryTab = () => (
  <div style={{ padding: '24px 32px' }}>
    <div className="body-md muted">12 commits over 8 days · 3 contributors</div>
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[
        { hash: 'a4c2f01', who: 'director',     when: 'today 14:02', msg: 'add icp + competitors from onboarding', diff: '+18 −0' },
        { hash: '3d8e1b2', who: 'you',          when: 'today 09:18', msg: 'tighten brand_voice', diff: '+4 −7' },
        { hash: '7f1a9c4', who: 'content-lead', when: 'Apr 24',      msg: 'append Q1 retrospective notes', diff: '+22 −1' },
        { hash: 'c20a3e5', who: 'director',     when: 'Apr 23',      msg: 'add trigger_event field', diff: '+2 −0' },
        { hash: '811b6df', who: 'you',          when: 'Apr 21',      msg: 'initial profile', diff: '+34 −0' },
      ].map(c => (
        <div key={c.hash} className="card" style={{ padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{c.hash}</span>
            <span className="body-md" style={{ flex: 1, fontSize: 14 }}>{c.msg}</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--success-deep)' }}>{c.diff}</span>
          </div>
          <div className="body-sm muted" style={{ marginTop: 4, fontSize: 12 }}>{c.who} · {c.when}</div>
        </div>
      ))}
    </div>
  </div>
);

window.MemoryScreen = MemoryScreen;
