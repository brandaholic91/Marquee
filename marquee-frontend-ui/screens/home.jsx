/* global React */
const { useState: useStateHome } = React;

const HomeScreen = () => {
  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 36px)', background: 'var(--cream)' }}>
      <Sidebar activeNav="home" />
      <main style={{ flex: 1, minWidth: 0, padding: '28px 32px 32px', overflow: 'auto' }}>
        <HomeHeader />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 24 }}>
          <ApprovalsWidget />
          <LiveFeedWidget />
          <PipelineWidget />
          <ConversationsWidget />
        </div>
      </main>
      <ChatDrawer />
    </div>
  );
};

const HomeHeader = () => (
  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
    <div>
      <div className="caption" style={{ marginBottom: 4 }}>Tuesday · April 27</div>
      <h1 className="headline-lg" style={{ margin: 0 }}>Good afternoon, Bálazs.</h1>
      <div className="body-md" style={{ color: 'var(--ink-2)', marginTop: 6 }}>
        The team's been busy — three things are ready for your eyes whenever you have a minute.
      </div>
    </div>
    <div style={{ display: 'flex', gap: 8 }}>
      <button className="btn btn-secondary">New brief</button>
    </div>
  </div>
);

// ---- Widget chrome ----
const Widget = ({ title, right, children, style }) => (
  <section className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 320, ...style }}>
    <header style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                     borderBottom: '1px solid var(--rule)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h2 className="title-md" style={{ margin: 0 }}>{title}</h2>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{right}</div>
    </header>
    <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
  </section>
);

// ---- 1. Approvals ----
const ApprovalsWidget = () => {
  const items = [
    { title: 'Why your PLG dashboard onboarding loses 60% of trials', type: 'blog_post', owner: 'copywriter', primary: true },
    { title: 'Stackly vs Databox: a PLG-first comparison', type: 'blog_post', owner: 'copywriter' },
    { title: 'Q2 content calendar — June', type: 'deliverable_plan', owner: 'content-lead' },
  ];
  return (
    <Widget
      title="Awaiting your approval"
      right={<span className="badge badge-primary-soft">3</span>}
    >
      <div>
        {items.map((it, i) => (
          <div key={i} style={{
            padding: '14px 18px',
            borderBottom: i < items.length - 1 ? '1px solid var(--rule)' : 'none',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <a href="#/deliverable" style={{ textDecoration: 'none', color: 'var(--ink-1)', fontSize: 14, fontWeight: 500, lineHeight: 1.35 }}>
              {it.title}
            </a>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="badge badge-cream" style={{ fontFamily: 'var(--font-mono)' }}>{it.type}</span>
                <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>·</span>
                <AgentBadge slug={it.owner} active />
                {it.primary && <span className="badge badge-primary-soft" style={{ marginLeft: 4 }}>awaiting_approval</span>}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {i === 0
                  ? <button className="btn btn-primary btn-sm">Approve</button>
                  : <button className="btn btn-secondary btn-sm">Approve</button>}
                <button className="btn btn-ghost btn-sm">View</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Widget>
  );
};

// ---- 2. Live Agent Feed ----
const FEED = [
  { active: true,  ts: '14:32:08', agent: 'copywriter',   ev: 'tool_call',          payload: 'submit_deliverable' },
  { active: true,  ts: '14:32:07', agent: 'copywriter',   ev: 'message_update',     payload: '"…the second metric never resets after a refresh."' },
  { active: true,  ts: '14:31:55', agent: 'director',     ev: 'delegation_created', payload: '→ content-lead' },
  { active: false, ts: '14:31:42', agent: 'eval-judge',   ev: 'turn_end',           payload: 'cost: $0.04' },
  { active: true,  ts: '14:31:30', agent: 'content-lead', ev: 'delegation_created', payload: '→ copywriter' },
  { active: false, ts: '14:30:58', agent: 'eval-judge',   ev: 'submit_eval_report', payload: 'brand_voice 4/5' },
  { active: true,  ts: '14:30:11', agent: 'copywriter',   ev: 'turn_start',         payload: 'rev_002' },
  { active: false, ts: '14:29:44', agent: 'analytics',    ev: 'turn_end',           payload: 'cost: $0.02' },
  { active: true,  ts: '14:29:12', agent: 'director',     ev: 'message_update',     payload: '"Let me draft a topic cluster for…"' },
  { active: false, ts: '14:28:51', agent: 'eval-judge',   ev: 'turn_end',           payload: 'cost: $0.03' },
];

const LiveFeedWidget = () => (
  <Widget title="Live" right={<span className="caption" style={{ color: 'var(--ink-3)' }}>auto-scroll</span>}>
    <div className="scroll" style={{ height: 320 }}>
      {FEED.map((r, i) => (
        <div key={i} className="marquee-ticker" style={{
          padding: '6px 18px',
          borderBottom: i < FEED.length - 1 ? '1px solid rgba(226, 219, 203, 0.5)' : 'none',
          display: 'grid',
          gridTemplateColumns: '14px 64px 110px 150px 1fr',
          alignItems: 'center', gap: 10,
        }}>
          <span style={{ color: r.active ? 'var(--bulb)' : 'var(--ink-3)', fontSize: 10 }}>{r.active ? '●' : '○'}</span>
          <span className="dim">{r.ts}</span>
          <span>{r.agent}</span>
          <span className="em">{r.ev}</span>
          <span className="dim" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.payload}</span>
        </div>
      ))}
    </div>
  </Widget>
);

// ---- 3. Pipeline ----
const PIPELINE = [
  { label: 'Drafting',           count: 3,  badge: 'secondary-soft' },
  { label: 'Awaiting eval',      count: 1,  badge: 'cream' },
  { label: 'Awaiting approval',  count: 3,  badge: 'primary-soft' },
  { label: 'Shipped this week',  count: 12, badge: 'success-soft' },
  { label: 'Blocked',            count: 1,  badge: 'danger-soft' },
];

const PipelineWidget = () => (
  <Widget title="Pipeline" right={<span className="body-sm muted">8 active</span>}>
    <div>
      {PIPELINE.map((row, i) => (
        <a key={row.label} href="#/home" style={{
          padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: i < PIPELINE.length - 1 ? '1px solid var(--rule)' : 'none',
          textDecoration: 'none', color: 'inherit',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className={`badge badge-${row.badge}`}>{row.label.toLowerCase().replace(/ /g, '_')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span className="serif" style={{ fontSize: 22, color: 'var(--ink-1)' }}>{row.count}</span>
            <span className="caption" style={{ color: 'var(--ink-3)' }}>›</span>
          </div>
        </a>
      ))}
    </div>
  </Widget>
);

// ---- 4. Active Conversations ----
const CONVOS = [
  { title: 'Q2 content strategy',    last: 'Director: Let me draft a topic cluster for…',         ago: '3m ago',   parts: ['director', 'content-lead'], active: true },
  { title: 'Geckoboard alternative LP', last: 'Copywriter: Question on the headline tone…',       ago: '18m ago',  parts: ['copywriter', 'content-lead'], active: true },
  { title: 'Brand voice tightening', last: 'You: Let\'s drop the "in this article we will…" intros.', ago: '2h ago', parts: ['director'], active: false },
  { title: 'Databox comparison facts', last: 'Copywriter: pulled three pricing screenshots.',     ago: '5h ago',   parts: ['copywriter'], active: false },
];

const ConversationsWidget = () => (
  <Widget title="Open chats" right={<button className="btn btn-ghost btn-sm">+ new</button>}>
    <div>
      {CONVOS.map((c, i) => (
        <a key={c.title} href="#/chat" style={{
          padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 6,
          borderBottom: i < CONVOS.length - 1 ? '1px solid var(--rule)' : 'none',
          textDecoration: 'none', color: 'inherit',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.3 }}>{c.title}</div>
            <div className="body-sm muted" style={{ flex: 'none' }}>{c.ago}</div>
          </div>
          <div className="body-sm" style={{ color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.last}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
            {c.parts.map(p => <AgentBadge key={p} slug={p} active={c.active && p === c.parts[0]} />)}
          </div>
        </a>
      ))}
    </div>
  </Widget>
);

// ---- Right chat drawer ----
const ChatDrawer = () => {
  const tabs = ['Q2 content strategy', 'Geckoboard alt LP', 'Brand voice'];
  const [tab, setTab] = useStateHome(0);

  return (
    <aside style={{ width: 384, background: 'var(--parchment)', borderLeft: '1px solid var(--rule)',
                    display: 'flex', flexDirection: 'column', height: 'calc(100vh - 36px)' }}>
      {/* tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--rule)', padding: '0 8px',
                    overflow: 'hidden', flexShrink: 0 }}>
        {tabs.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: '12px 12px', fontSize: 12,
            color: tab === i ? 'var(--ink-1)' : 'var(--ink-3)',
            fontWeight: tab === i ? 600 : 500,
            boxShadow: tab === i ? 'inset 0 -2px 0 var(--ink-1)' : 'none',
            whiteSpace: 'nowrap',
          }}>{t}</button>
        ))}
        <button style={{ padding: '12px 10px', color: 'var(--ink-3)', fontSize: 14, marginLeft: 'auto' }}>+</button>
      </div>

      {/* thread title */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--rule)' }}>
        <div className="title-md">{tabs[tab]}</div>
        <div className="body-sm muted" style={{ marginTop: 2, display: 'flex', gap: 4, alignItems: 'center' }}>
          <AgentBadge slug="director" active /><AgentBadge slug="content-lead" active />
          <span style={{ marginLeft: 6 }}>· dispatched thread</span>
        </div>
      </div>

      {/* messages */}
      <div className="scroll" style={{ flex: 1, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <DrawerMsg who="human" name="You" time="13:42">
          Let's plan Q2 content. I want to lean into the activation-plateau moment — that's the sharpest pain
          for our ICP right now.
        </DrawerMsg>
        <DrawerMsg who="director" name="Director" time="13:43" active>
          Agreed. <span className="mention">@content-lead</span> can you scope a topic cluster around activation
          metrics, with three pillar pieces and six supporting?
        </DrawerMsg>
        <DrawerMsg who="content-lead" name="Content Lead" time="13:48" active>
          On it. Pillars I'd lead with: (1) <em>activation rate is a vanity metric</em>,
          (2) <em>the second-touch problem</em>, (3) <em>what to instrument before A/B testing</em>.
        </DrawerMsg>
        <DrawerMsg who="director" name="Director" time="13:51" active>
          Good. Draft this as an addition to ongoing_campaigns and I'll push it to you.
        </DrawerMsg>

        <MemoryProposalCard />

        <DrawerMsg who="human" name="You" time="14:02">
          Looks right. Approving.
        </DrawerMsg>
      </div>

      {/* input */}
      <div style={{ padding: 12, borderTop: '1px solid var(--rule)', background: 'var(--parchment)' }}>
        <div style={{ background: 'var(--white)', border: '1px solid var(--rule-strong)', borderRadius: 6, padding: 10 }}>
          <textarea className="textarea-chat" style={{ border: 0, padding: 2, minHeight: 44 }}
            placeholder="Reply, or @ to invite a teammate" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <span className="body-sm muted">⏎ to send</span>
            <button className="btn btn-secondary btn-sm">Send</button>
          </div>
        </div>
      </div>
    </aside>
  );
};

const DrawerMsg = ({ who, name, time, active, children }) => (
  <div style={{ display: 'flex', gap: 10 }}>
    <Avatar who={who} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{name}</span>
        {active && <Bulb active />}
        <span className="body-sm muted">{time}</span>
      </div>
      <div className="body-sm" style={{ color: 'var(--ink-1)', fontSize: 13, lineHeight: 1.5 }}>{children}</div>
    </div>
  </div>
);

const MemoryProposalCard = () => (
  <div style={{ display: 'flex', gap: 10 }}>
    <Avatar who="content-lead" />
    <div style={{ flex: 1 }}>
      <div style={{ border: '1px solid var(--bulb)', borderRadius: 6, background: 'var(--white)', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', background: 'rgba(232, 154, 44, 0.10)',
                      borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--warning-deep)', letterSpacing: '0.08em', fontWeight: 600 }}>MEMORY · PROPOSAL</span>
        </div>
        <div style={{ padding: 14 }}>
          <div className="body-sm" style={{ color: 'var(--ink-1)', fontSize: 13 }}>
            <strong>content-lead</strong> suggests updating <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>ongoing_campaigns.md</code>
          </div>
          <pre style={{ margin: '10px 0 0', padding: '10px 12px', background: 'var(--cream)',
                        borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.5,
                        whiteSpace: 'pre-wrap' }}>
{'  ## Q1 — onboarding deep dive\n'}
<span className="diff-add">{'+ ## Q2 — PLG dashboard education series'}</span>{'\n'}
{'    pillars:\n'}
<span className="diff-add">{'+   - activation rate is a vanity metric'}</span>{'\n'}
<span className="diff-add">{'+   - the second-touch problem'}</span>
          </pre>
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <button className="btn btn-secondary btn-sm">Approve & commit</button>
            <button className="btn btn-ghost btn-sm">Reject</button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

window.HomeScreen = HomeScreen;
