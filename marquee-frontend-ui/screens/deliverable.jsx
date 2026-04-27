/* global React */
const { useState: useStateDelv } = React;

const DeliverableScreen = () => {
  const [tab, setTab] = useStateDelv('thread');

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 36px)', background: 'var(--cream)' }}>
      <Sidebar activeNav="home" collapsed />
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        <DeliverableTopBar />
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '60% 40%', minHeight: 0 }}>
          <MarkdownPreview />
          <SidePanel tab={tab} setTab={setTab} />
        </div>
      </main>
    </div>
  );
};

const DeliverableTopBar = () => (
  <header style={{ background: 'var(--cream)', padding: '20px 32px 16px',
                   borderBottom: '1px solid var(--rule)', display: 'flex',
                   alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <a href="#/home" className="body-sm muted" style={{ textDecoration: 'none' }}>← Approvals queue</a>
      <h1 className="headline-lg" style={{ margin: '8px 0 0', maxWidth: 760 }}>
        Why your PLG dashboard onboarding loses 60% of trials
      </h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <span className="badge badge-primary-soft">awaiting_approval</span>
        <span className="badge badge-cream" style={{ fontFamily: 'var(--font-mono)' }}>blog_post</span>
        <span className="body-sm muted">·</span>
        <span className="body-sm muted">owner</span>
        <AgentBadge slug="copywriter" active />
        <span className="body-sm muted">· rev_002 · 612 words · est. 4 min read</span>
      </div>
    </div>
    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
      <button className="btn btn-primary">Approve & ship</button>
      <button className="btn btn-secondary">Request changes</button>
      <button className="btn btn-ghost">Reject</button>
    </div>
  </header>
);

const MarkdownPreview = () => (
  <div style={{ padding: '24px 32px', overflow: 'auto' }}>
    <article className="card" style={{ background: 'var(--white)', padding: '40px 48px', maxWidth: 720 }}>
      <div className="caption" style={{ marginBottom: 8, color: 'var(--ink-3)' }}>STACKLY · DRAFT</div>
      <h1 className="headline-lg" style={{ margin: 0 }}>Why your PLG dashboard onboarding loses 60% of trials</h1>
      <div className="body-sm" style={{ marginTop: 12, color: 'var(--ink-2)' }}>
        By the Stackly team · 4 min read
      </div>

      <hr className="hr" style={{ margin: '24px 0' }} />

      <p className="body-md" style={{ fontSize: 16, lineHeight: 1.7 }}>
        The median PLG dashboard product loses 60% of trial signups before the second session. Not the second
        week. The second <em>session</em>. We pulled this number from anonymized data across 41 Stackly customers
        who instrumented activation funnels in Q4 — and the shape of the drop-off is consistent enough that we
        think it's structural, not a positioning problem.
      </p>

      <h2 className="headline-md" style={{ margin: '28px 0 10px', fontSize: 22 }}>The second-touch problem</h2>
      <p className="body-md" style={{ fontSize: 16, lineHeight: 1.7 }}>
        Most onboarding teams optimize for the first session: time-to-value, time-to-aha, time-to-first-chart. The
        problem is that nothing about the first session predicts the second one. A user can complete every
        scripted step, hit every milestone you've defined, and still not return. The signal you actually want
        — <em>did they come back without being prompted?</em> — is one most products don't track at all.
      </p>

      <blockquote style={{
        margin: '24px 0', padding: '12px 20px', borderLeft: '3px solid var(--primary)',
        background: 'var(--primary-soft)', color: 'var(--primary-deep)',
        fontFamily: 'var(--font-serif)', fontSize: 18, lineHeight: 1.5, fontStyle: 'italic',
      }}>
        "The second metric never resets after a refresh. That's what made me realize Mixpanel wasn't measuring
        what I thought it was."
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontStyle: 'normal',
                      marginTop: 8, color: 'var(--ink-2)' }}>
          — Head of Growth, anonymous Stackly customer
        </div>
      </blockquote>

      <h2 className="headline-md" style={{ margin: '28px 0 10px', fontSize: 22 }}>What to instrument first</h2>
      <p className="body-md" style={{ fontSize: 16, lineHeight: 1.7 }}>
        Before you A/B test anything, you need three events with reliable timestamps. Most products have one or
        two. We'd argue you don't have a real activation funnel until you have:
      </p>
      <ul className="body-md" style={{ fontSize: 16, lineHeight: 1.8, paddingLeft: 24 }}>
        <li><strong>First meaningful action.</strong> Not a click. The first action whose absence would make a user say "this product doesn't work for me."</li>
        <li><strong>Unprompted return.</strong> A second session without an onboarding email, push, or in-app nudge in the preceding 24 hours.</li>
        <li><strong>Second meaningful action.</strong> Same definition as the first, executed at least once during the unprompted return.</li>
      </ul>

      <h2 className="headline-md" style={{ margin: '28px 0 10px', fontSize: 22 }}>Where teams go wrong</h2>
      <p className="body-md" style={{ fontSize: 16, lineHeight: 1.7 }}>
        The most common failure mode we see: teams treat activation rate as a leading indicator of retention.
        It's not. Activation rate is a leading indicator of <em>activation rate</em>. If you want to know whether
        your product is sticky, you need to measure stickiness directly. We wrote a longer breakdown of how to
        instrument this in <a href="#" style={{ color: 'var(--primary-deep)', textDecoration: 'underline' }}>the Stackly second-touch playbook</a>.
      </p>
      <p className="body-md" style={{ fontSize: 16, lineHeight: 1.7 }}>
        The good news: once you have these three events wired, you'll find that the answer to "why are trials
        leaking?" is usually obvious within a week. The bad news: the answer is almost never the part of the
        funnel you've been A/B testing.
      </p>
    </article>
  </div>
);

const SidePanel = ({ tab, setTab }) => (
  <aside style={{ background: 'var(--parchment)', borderLeft: '1px solid var(--rule)',
                  display: 'flex', flexDirection: 'column', minHeight: 0 }}>
    <div style={{ display: 'flex', borderBottom: '1px solid var(--rule)', padding: '0 12px' }}>
      {[
        { id: 'thread',    label: 'Thread' },
        { id: 'eval',      label: 'Eval' },
        { id: 'revisions', label: 'Revisions' },
      ].map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} style={{
          padding: '14px 14px', fontSize: 13,
          color: tab === t.id ? 'var(--ink-1)' : 'var(--ink-3)',
          fontWeight: tab === t.id ? 600 : 500,
          boxShadow: tab === t.id ? 'inset 0 -2px 0 var(--ink-1)' : 'none',
        }}>{t.label}</button>
      ))}
    </div>
    <div className="scroll" style={{ flex: 1, padding: 18 }}>
      {tab === 'thread' && <ThreadTab />}
      {tab === 'eval' && <EvalTab />}
      {tab === 'revisions' && <RevisionsTab />}
    </div>
  </aside>
);

const TMsg = ({ who, name, time, children, active }) => (
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

const SysLine = ({ children }) => (
  <div style={{ paddingLeft: 32, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
    · {children}
  </div>
);

const ThreadTab = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <TMsg who="content-lead" name="Content Lead" time="14:08" active>
      <span className="mention">@copywriter</span> draft the activation-vanity-metric pillar. Anchor on the
      60% number from Q4 analytics. No throat-clearing intro.
    </TMsg>
    <TMsg who="copywriter" name="Copywriter" time="14:11" active>
      Got it. Pulling the second-touch quote from the Q4 customer interviews — that's the strongest hook.
    </TMsg>
    <SysLine>copywriter submitted rev_001 · 14:24</SysLine>
    <SysLine>eval-judge submitted score · brand_voice 3/5 · 14:26</SysLine>
    <TMsg who="eval-judge" name="Eval Judge" time="14:26">
      Voice drifts in §3 — "we wrote a longer breakdown" is closer to copywriter-house than Stackly-house.
      Otherwise tight. Suggest one revision.
    </TMsg>
    <TMsg who="copywriter" name="Copywriter" time="14:30" active>
      Fair. Tightening §3, keeping the rest. Resubmitting as rev_002.
    </TMsg>
    <SysLine>copywriter submitted rev_002 · 14:32</SysLine>
    <SysLine>eval-judge submitted score · brand_voice 4/5 · 14:33</SysLine>
    <TMsg who="director" name="Director" time="14:34" active>
      Cleared eval. Ready for your approval.
    </TMsg>
  </div>
);

const EvalTab = () => {
  const scores = [
    { dim: 'brand_voice',      score: 4 },
    { dim: 'factual_accuracy', score: 5 },
    { dim: 'usp_usage',        score: 3 },
  ];
  return (
    <div>
      <div className="caption" style={{ marginBottom: 12 }}>EVAL · rev_002 · 14:33</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {scores.map(s => (
          <div key={s.dim}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span className="mono" style={{ fontSize: 12 }}>{s.dim}</span>
              <span className="serif" style={{ fontSize: 14 }}>{s.score}<span className="muted" style={{ fontSize: 12 }}>/5</span></span>
            </div>
            <div style={{ display: 'flex', gap: 3, height: 6 }}>
              {[1,2,3,4,5].map(n => (
                <div key={n} style={{ flex: 1, borderRadius: 1,
                  background: n <= s.score ? 'var(--ink-1)' : 'rgba(40,38,34,0.10)' }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 22, padding: 14, background: 'var(--white)', borderRadius: 6, border: '1px solid var(--rule)' }}>
        <div className="caption" style={{ marginBottom: 8 }}>SUMMARY · eval-judge</div>
        <p className="body-sm" style={{ color: 'var(--ink-1)', fontSize: 13, lineHeight: 1.55, margin: 0 }}>
          Strong on factual accuracy — the 60% number is sourced from rev_001's analytics pull and verified.
          Voice landed after the §3 tightening. USP usage is light: the piece reads as generic PLG advice; one
          concrete reference to Stackly's second-touch instrumentation would lift the score to 4.
        </p>
      </div>

      <button className="btn btn-ghost btn-sm" style={{ marginTop: 16, paddingLeft: 0 }}>View full eval history (3) →</button>
    </div>
  );
};

const RevisionsTab = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    {[
      { id: 'rev_002', who: 'copywriter', when: '14:32', note: 'tightened §3, removed self-reference', current: true },
      { id: 'rev_001', who: 'copywriter', when: '14:24', note: 'initial draft from brief_004' },
    ].map(r => (
      <div key={r.id} className="card" style={{ padding: 12, background: r.current ? 'var(--white)' : 'transparent', borderColor: r.current ? 'var(--rule-strong)' : 'var(--rule)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{r.id}</div>
          {r.current && <span className="badge badge-cream">current</span>}
        </div>
        <div className="body-sm" style={{ marginTop: 4 }}>{r.note}</div>
        <div className="body-sm muted" style={{ marginTop: 4 }}>{r.who} · {r.when}</div>
      </div>
    ))}
  </div>
);

window.DeliverableScreen = DeliverableScreen;
