/* global React */
const OnboardingScreen = () => {
  const messages = [
    { who: 'director', name: 'Director',
      text: <>Hey, glad you're here 👋 Let's get your first client set up. Who are you working with, and what do they make?</> },
    { who: 'human', name: 'You',
      text: <>Stackly. They make a PLG SaaS analytics dashboard.</> },
    { who: 'director', name: 'Director',
      text: <>Nice — I've heard good things. Tell me a bit about their ideal customer? Who buys this, who champions it internally, and what usually pushes them to start looking?</> },
    { who: 'human', name: 'You',
      text: <>10–100 employee SaaS companies with PLG growth motions. Growth teams of 2–10 people. Usually triggered when activation rate plateaus and the founder asks where the funnel leaks.</> },
    { who: 'director', name: 'Director',
      text: <>Perfect, that gives me plenty to work with. I sketched up a client profile from what you told me — take a look below and tweak anything that feels off. Once you're happy with it, I'll share it with the rest of the team.</> },
  ];

  return (
    <div style={{ minHeight: 'calc(100vh - 36px)', background: 'var(--parchment)',
                  background: `radial-gradient(ellipse at top, #F2EBDA 0%, #EFE8DA 60%)`,
                  display: 'flex', flexDirection: 'column' }}>
      {/* slim top */}
      <div style={{ padding: '24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="mono" style={{ fontSize: 12, letterSpacing: '0.12em', color: 'var(--ink-2)' }}>MARQUEE</div>
        <div className="body-sm">First-run setup · step 1 of 3</div>
      </div>

      {/* centered chat */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '32px 32px 0' }}>
        <div style={{ width: '100%', maxWidth: 768, display: 'flex', flexDirection: 'column', gap: 24 }}>

          <div>
            <div className="display-lg">Welcome to marquee</div>
            <div className="body-md" style={{ color: 'var(--ink-2)', marginTop: 12, maxWidth: 560 }}>
              Your agency runs on shared memory — a handful of markdown files the team reads before every task.
              The Director will help you fill them in. It's pretty quick, promise.
            </div>
          </div>

          <hr className="hr" />

          {/* messages */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {messages.map((m, i) => <ChatMessage key={i} {...m} />)}

            {/* Brief proposal card — primary border */}
            <BriefProposalCard />
          </div>

          {/* sticky input */}
          <div style={{ position: 'sticky', bottom: 24, marginTop: 24, paddingBottom: 24 }}>
            <div className="card" style={{ padding: 14, background: 'var(--white)', borderColor: 'var(--rule-strong)' }}>
              <textarea
                className="textarea-chat"
                style={{ border: 0, padding: 4, minHeight: 56 }}
                placeholder="Reply to Director, or type @ to invite a teammate"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <div className="body-sm muted">@mention to bring in another agent · ⏎ to send</div>
                <button className="btn btn-secondary btn-sm">Send</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ChatMessage = ({ who, name, text }) => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
    <Avatar who={who} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{name}</span>
        {who !== 'human' && <Bulb active />}
        <span className="body-sm muted">14:0{Math.floor(Math.random() * 6)}</span>
      </div>
      <div className="body-md" style={{ color: 'var(--ink-1)' }}>{text}</div>
    </div>
  </div>
);

const BriefProposalCard = () => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
    <Avatar who="director" />
    <div style={{ flex: 1 }}>
      <div className="card" style={{
        border: '1px solid var(--primary)',
        borderRadius: 6,
        background: 'var(--white)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 8,
                      borderBottom: '1px solid var(--rule)', background: 'var(--primary-soft)' }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--primary-deep)', letterSpacing: '0.08em', fontWeight: 600 }}>BRIEF · PROPOSAL</span>
          <span className="body-sm" style={{ color: 'var(--primary-deep)', marginLeft: 'auto' }}>director · just now</span>
        </div>
        <div style={{ padding: 20 }}>
          <div className="title-md">Stackly — client profile draft</div>
          <p className="body-md" style={{ color: 'var(--ink-2)', marginTop: 6 }}>
            I'll save this to <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-1)' }}>client_profile.md</code> so
            the team can reference it.
          </p>

          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 8, columnGap: 16 }}>
            {[
              ['client_name', 'Stackly'],
              ['product', 'PLG SaaS analytics dashboard'],
              ['icp', '10–100 employee SaaS companies, PLG motion, growth teams of 2–10'],
              ['trigger', 'activation plateau, founder asking where the funnel leaks'],
              ['brand_voice', 'data-driven, tight, non-promotional'],
            ].map(([k, v]) => (
              <React.Fragment key={k}>
                <div className="mono" style={{ fontSize: 12, color: 'var(--ink-3)', paddingTop: 2 }}>{k}</div>
                <div className="body-md">{v}</div>
              </React.Fragment>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button className="btn btn-primary">Approve & save</button>
            <button className="btn btn-secondary">Edit</button>
            <button className="btn btn-ghost">Discard</button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

window.OnboardingScreen = OnboardingScreen;
