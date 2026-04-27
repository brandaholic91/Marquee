/* global React */
const ChatScreen = () => {
  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 36px)', background: 'var(--cream)' }}>
      <Sidebar activeNav="home" />
      <main style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center', overflow: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 896, padding: '32px 32px 32px', display: 'flex', flexDirection: 'column' }}>
          <ChatHeader />
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 22, paddingBottom: 100 }}>
            <CMsg who="human" name="You" time="13:42">
              Let's plan Q2 content. I want to lean into the activation-plateau moment — that's the sharpest pain
              for our ICP right now.
            </CMsg>
            <CMsg who="director" name="Director" time="13:43" active>
              Agreed. <span className="mention">@content-lead</span> can you scope a topic cluster around activation
              metrics — three pillar pieces and six supporting?
            </CMsg>
            <CMsg who="content-lead" name="Content Lead" time="13:48" active>
              On it. Reading <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>content_history.md</code> first to make sure I'm not duplicating
              anything we shipped in Q1.
            </CMsg>

            <SystemEntry>content-lead read <code>memory/content_history.md</code></SystemEntry>

            <CMsg who="content-lead" name="Content Lead" time="13:51" active>
              Pillars I'd lead with:
              <ol style={{ margin: '6px 0 0 0', paddingLeft: 22 }}>
                <li><em>"Activation rate is a vanity metric — here's what to track instead"</em></li>
                <li><em>"The second-touch problem: why your day-2 retention is lying to you"</em></li>
                <li><em>"What to instrument before you start A/B testing onboarding"</em></li>
              </ol>
              Each pillar gets 2 supporting pieces (a tactical how-to and a teardown of a public PLG product).
            </CMsg>
            <CMsg who="director" name="Director" time="13:52" active>
              Strong. Draft this as an addition to <code>ongoing_campaigns.md</code> and propose it.
            </CMsg>

            <BriefProposalInline />

            <CMsg who="human" name="You" time="14:02">
              This is right. One nit — pillar 2 should mention specific metrics (DAU/WAU ratio, action-completion).
              Approving with that note.
            </CMsg>

            <SystemEntry status="ok">You approved <strong>brief_001</strong> · dispatched to content-lead</SystemEntry>

            <CMsg who="content-lead" name="Content Lead" time="14:03" active>
              Got it. Dispatching pillar 1 to <span className="mention">@copywriter</span> first — it's the most
              cited topic in our analytics.
            </CMsg>

            <SystemEntry>delegation_created · content-lead → copywriter · <code>blog_post · activation-vanity-metric</code></SystemEntry>

            <CMsg who="copywriter" name="Copywriter" time="14:08" active>
              Pulling references. I have three teardowns I want to cite — Linear's onboarding, Notion's
              activation funnel, and our own Stackly Q4 case. Confirming tone: tight, non-promotional,
              no "in this article we'll explore…" intro.
            </CMsg>
            <CMsg who="content-lead" name="Content Lead" time="14:11" active>
              Confirmed. Skip the throat-clearing. Open on a concrete number.
            </CMsg>
          </div>

          {/* sticky input */}
          <div style={{ position: 'sticky', bottom: 24, marginTop: 'auto' }}>
            <div className="card" style={{ padding: 12, borderColor: 'var(--rule-strong)' }}>
              <textarea className="textarea-chat" style={{ border: 0, padding: 4, minHeight: 56 }}
                placeholder="Reply, or @ to invite a teammate" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <span className="body-sm muted">@director · @content-lead · @copywriter · ⏎ to send</span>
                <button className="btn btn-secondary btn-sm">Send</button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* collapsed thread tab */}
      <aside style={{ width: 44, background: 'var(--parchment)', borderLeft: '1px solid var(--rule)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', gap: 16 }}>
        <div className="caption" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', color: 'var(--ink-3)' }}>
          OTHER THREADS
        </div>
        {[
          { t: 'Geckoboard alt LP', active: true },
          { t: 'Brand voice tightening', active: false },
          { t: 'Databox comparison', active: false },
        ].map(c => (
          <div key={c.t} title={c.t} style={{
            writingMode: 'vertical-rl', transform: 'rotate(180deg)', padding: '6px 4px',
            fontSize: 11, color: c.active ? 'var(--ink-1)' : 'var(--ink-3)',
            borderLeft: c.active ? '2px solid var(--bulb)' : '2px solid transparent',
          }}>
            {c.t}
          </div>
        ))}
      </aside>
    </div>
  );
};

const ChatHeader = () => (
  <div>
    <a href="#/home" className="body-sm muted" style={{ textDecoration: 'none' }}>← Home</a>
    <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <h1 className="headline-md" style={{ margin: 0 }}>Q2 content strategy</h1>
      <span className="badge badge-cream" style={{ fontFamily: 'var(--font-mono)' }}>thread · dispatched</span>
    </div>
    <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center' }}>
      <AgentBadge slug="director" active />
      <AgentBadge slug="content-lead" active />
      <AgentBadge slug="copywriter" active />
      <span className="body-sm muted" style={{ marginLeft: 6 }}>· started 13:42 · 12 messages so far</span>
    </div>
  </div>
);

const CMsg = ({ who, name, time, active, children }) => (
  <div style={{ display: 'flex', gap: 14 }}>
    <Avatar who={who} className="avatar-md" />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{name}</span>
        {active && <Bulb active />}
        <span className="body-sm muted">{time}</span>
      </div>
      <div className="body-md">{children}</div>
    </div>
  </div>
);

const SystemEntry = ({ status, children }) => (
  <div style={{ paddingLeft: 42, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)',
                display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ color: status === 'ok' ? 'var(--success-deep)' : 'var(--ink-3)' }}>
      {status === 'ok' ? '✓' : '·'}
    </span>
    <span>{children}</span>
  </div>
);

const BriefProposalInline = () => (
  <div style={{ display: 'flex', gap: 14 }}>
    <Avatar who="content-lead" />
    <div style={{ flex: 1 }}>
      <div style={{ border: '1px solid var(--primary)', borderRadius: 6, background: 'var(--white)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', background: 'var(--primary-soft)',
                      borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'center' }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--primary-deep)', letterSpacing: '0.08em', fontWeight: 600 }}>BRIEF · PROPOSAL</span>
          <span className="body-sm" style={{ color: 'var(--primary-deep)', marginLeft: 'auto' }}>content-lead · 13:58</span>
        </div>
        <div style={{ padding: 18 }}>
          <div className="title-md">Q2 — PLG dashboard education series</div>
          <div className="body-sm" style={{ color: 'var(--ink-2)', marginTop: 4 }}>
            3 pillars × 2 supporting = 9 deliverables. Target ship: weeks 18–26.
          </div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {['Activation rate is a vanity metric — what to track instead',
              'The second-touch problem: why day-2 retention lies',
              'What to instrument before you A/B test onboarding'].map((p, i) => (
              <div key={p} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>P{i+1}</span>
                <span className="body-md">{p}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn btn-primary">Approve & dispatch</button>
            <button className="btn btn-secondary">Edit</button>
            <button className="btn btn-ghost">Discard</button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

window.ChatScreen = ChatScreen;
