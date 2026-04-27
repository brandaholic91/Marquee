import { useState, useEffect, useRef, type ReactNode } from "react";
import { api } from "../lib/api.js";
import { useAgencyStore } from "../store/useAgencyStore.js";
import { Avatar, AgentBadge, Bulb } from "../components/ui/index.js";
import { Sidebar } from "../components/layout/Sidebar.js";
import type { AvatarWho } from "../components/ui/index.js";

// ---- Types ----

interface Message {
  id: string;
  role: "user" | "assistant" | "event";
  text: string;
  agentSlug?: string;
  createdAt: string;
}

interface Thread {
  id: string;
  title: string;
}

interface SnapshotData {
  threads: Thread[];
  approvals?: unknown[];
  pipeline?: unknown[];
  activeAgents?: { agentSlug: string }[];
}

interface BriefProposal {
  id: string;
  title: string;
  description?: string;
}

// ---- ChatHeader ----

function ChatHeader({
  thread,
  messageCount,
  onBack,
}: {
  thread: Thread | null;
  messageCount: number;
  onBack: () => void;
}) {
  return (
    <div>
      <button
        className="body-sm"
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: "var(--ink-3)",
          textDecoration: "none",
        }}
        onClick={onBack}
      >
        ← Home
      </button>
      <div
        style={{
          marginTop: 14,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <h1 className="headline-md" style={{ margin: 0 }}>
          {thread?.title ?? "Conversation"}
        </h1>
        <span
          className="badge badge-cream"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          thread · dispatched
        </span>
      </div>
      <div
        style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center" }}
      >
        <AgentBadge slug="director" active />
        <AgentBadge slug="content-lead" active />
        <AgentBadge slug="copywriter" active />
        <span
          className="body-sm"
          style={{ color: "var(--ink-3)", marginLeft: 6 }}
        >
          · {messageCount} messages
        </span>
      </div>
    </div>
  );
}

// ---- CMsg ----

function CMsg({
  who,
  name,
  time,
  active,
  children,
}: {
  who: string;
  name: string;
  time?: string;
  active?: boolean;
  children: ReactNode;
}) {
  const safeWho = (who as AvatarWho) in
    {
      human: 1,
      director: 1,
      "content-lead": 1,
      copywriter: 1,
      "eval-judge": 1,
      analytics: 1,
      "distribution-lead": 1,
      "insights-lead": 1,
    }
    ? (who as AvatarWho)
    : "director";

  return (
    <div style={{ display: "flex", gap: 14 }}>
      <Avatar who={safeWho} size="md" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600 }}>{name}</span>
          {active && <Bulb active />}
          {time && (
            <span
              className="body-sm"
              style={{ color: "var(--ink-3)" }}
            >
              {time}
            </span>
          )}
        </div>
        <div className="body-md">{children}</div>
      </div>
    </div>
  );
}

// ---- SystemEntry ----

function SystemEntry({
  status,
  children,
}: {
  status?: "ok";
  children: ReactNode;
}) {
  return (
    <div
      style={{
        paddingLeft: 42,
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        color: "var(--ink-3)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span
        style={{
          color:
            status === "ok" ? "var(--success-deep)" : "var(--ink-3)",
        }}
      >
        {status === "ok" ? "✓" : "·"}
      </span>
      <span>{children}</span>
    </div>
  );
}

// ---- BriefProposalInline ----

function BriefProposalInline({
  brief,
  onRefresh,
}: {
  brief: BriefProposal;
  onRefresh: () => void;
}) {
  const deliverables = [
    "Activation rate is a vanity metric — what to track instead",
    "The second-touch problem: why day-2 retention lies",
    "What to instrument before you A/B test onboarding",
  ];

  return (
    <div style={{ display: "flex", gap: 14 }}>
      <Avatar who="content-lead" size="md" />
      <div style={{ flex: 1 }}>
        <div
          style={{
            border: "1px solid var(--primary)",
            borderRadius: 6,
            background: "var(--white)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              background: "var(--primary-soft)",
              borderBottom: "1px solid var(--rule)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--primary-deep)",
                letterSpacing: "0.08em",
                fontWeight: 600,
              }}
            >
              BRIEF · PROPOSAL
            </span>
            <span
              className="body-sm"
              style={{ color: "var(--primary-deep)", marginLeft: "auto" }}
            >
              content-lead
            </span>
          </div>
          <div style={{ padding: 18 }}>
            <div className="title-md">{brief.title}</div>
            {brief.description && (
              <div
                className="body-sm"
                style={{ color: "var(--ink-2)", marginTop: 4 }}
              >
                {brief.description}
              </div>
            )}
            <div
              style={{
                marginTop: 14,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {deliverables.map((p, i) => (
                <div
                  key={p}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "baseline",
                  }}
                >
                  <span
                    className="mono"
                    style={{ fontSize: 12, color: "var(--ink-3)" }}
                  >
                    P{i + 1}
                  </span>
                  <span className="body-md">{p}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                className="btn btn-primary"
                onClick={() =>
                  api.approvals
                    .decide(brief.id, "approved")
                    .then(onRefresh)
                    .catch(console.error)
                }
              >
                Approve &amp; dispatch
              </button>
              <button className="btn btn-secondary">Edit</button>
              <button className="btn btn-ghost">Discard</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- MessageRenderer ----

function MessageRenderer({
  msg,
  onRefresh,
}: {
  msg: Message;
  onRefresh: () => void;
}) {
  const isSystem =
    msg.role === "event" || msg.text.startsWith("[system]");

  if (isSystem) {
    const cleaned = msg.text.replace(/^\[system\]\s*/, "");
    return <SystemEntry>{cleaned}</SystemEntry>;
  }

  // Check if message contains a brief proposal (heuristic: text contains [brief:id])
  const briefMatch = msg.text.match(/\[brief:([^\]]+)\]/);
  if (briefMatch) {
    const briefId = briefMatch[1];
    const briefTitle = msg.text
      .replace(/\[brief:[^\]]+\]/, "")
      .trim();
    return (
      <BriefProposalInline
        brief={{ id: briefId, title: briefTitle || "Brief Proposal" }}
        onRefresh={onRefresh}
      />
    );
  }

  if (msg.role === "user") {
    const t = new Date(msg.createdAt).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      <CMsg who="human" name="You" time={t}>
        {msg.text}
      </CMsg>
    );
  }

  // assistant
  const slug = msg.agentSlug ?? "director";
  const displayName =
    slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ");
  const t = new Date(msg.createdAt).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <CMsg who={slug} name={displayName} time={t} active>
      {msg.text}
    </CMsg>
  );
}

// ---- OtherThreadsStrip ----

function OtherThreadsStrip({
  threads,
  activeThreadId,
}: {
  threads: Thread[];
  activeThreadId: string | null;
}) {
  const { setActiveThread } = useAgencyStore();

  return (
    <aside
      style={{
        width: 44,
        background: "var(--parchment)",
        borderLeft: "1px solid var(--rule)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "20px 0",
        gap: 16,
        flexShrink: 0,
      }}
    >
      <div
        className="caption"
        style={{
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
          color: "var(--ink-3)",
        }}
      >
        OTHER THREADS
      </div>
      {threads
        .filter((t) => t.id !== activeThreadId)
        .map((t) => (
          <button
            key={t.id}
            title={t.title}
            onClick={() => setActiveThread(t.id)}
            style={{
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              padding: "6px 4px",
              fontSize: 11,
              color: "var(--ink-3)",
              background: "none",
              border: "none",
              borderLeft: "2px solid transparent",
              cursor: "pointer",
              maxHeight: 140,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {t.title}
          </button>
        ))}
    </aside>
  );
}

// ---- StickyInput ----

function StickyInput({
  threadId,
  onSent,
}: {
  threadId: string;
  onSent: () => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await api.messages.post(threadId, trimmed);
      setText("");
      onSent();
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div style={{ position: "sticky", bottom: 24, marginTop: "auto" }}>
      <div
        className="card"
        style={{ padding: 12, borderColor: "var(--rule-strong)" }}
      >
        <textarea
          ref={textareaRef}
          className="textarea-chat"
          style={{ border: 0, padding: 4, minHeight: 56, width: "100%" }}
          placeholder="Reply, or @ to invite a teammate"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 4,
          }}
        >
          <span className="body-sm" style={{ color: "var(--ink-3)" }}>
            ⏎ to send
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => void handleSend()}
            disabled={sending || !text.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- ChatFullView ----

export function ChatFullView() {
  const { activeThreadId, setView } = useAgencyStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeThread =
    snapshot?.threads.find((t) => t.id === activeThreadId) ?? null;

  useEffect(() => {
    api.snapshot().then((data) => setSnapshot(data as SnapshotData));
  }, []);

  const loadMessages = () => {
    if (!activeThreadId) return;
    setLoading(true);
    api.threads
      .messages(activeThreadId)
      .then((msgs) => {
        setMessages(msgs as Message[]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    setMessages([]);
    loadMessages();
  }, [activeThreadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!activeThreadId) {
    return (
      <div
        style={{
          display: "flex",
          minHeight: "calc(100vh - 36px)",
          background: "var(--cream)",
        }}
      >
        <Sidebar activeNav="home" collapsed />
        <main
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--ink-3)",
            fontSize: 14,
          }}
        >
          Select a conversation
        </main>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "calc(100vh - 36px)",
        background: "var(--cream)",
      }}
    >
      {/* Collapsed sidebar */}
      <Sidebar activeNav="home" collapsed />

      {/* Main thread column */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          justifyContent: "center",
          overflow: "auto",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 896,
            padding: "32px 32px 32px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <ChatHeader
            thread={activeThread}
            messageCount={messages.length}
            onBack={() => setView("home")}
          />

          {/* Messages */}
          <div
            style={{
              marginTop: 24,
              display: "flex",
              flexDirection: "column",
              gap: 22,
              paddingBottom: 100,
            }}
          >
            {loading && (
              <div
                style={{
                  color: "var(--ink-3)",
                  fontSize: 13,
                  paddingLeft: 42,
                }}
              >
                Loading…
              </div>
            )}
            {!loading && messages.length === 0 && (
              <div
                style={{
                  color: "var(--ink-3)",
                  fontSize: 13,
                  paddingLeft: 42,
                }}
              >
                No messages yet. Start the conversation below.
              </div>
            )}
            {messages.map((msg) => (
              <MessageRenderer
                key={msg.id}
                msg={msg}
                onRefresh={loadMessages}
              />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Sticky input */}
          <StickyInput threadId={activeThreadId} onSent={loadMessages} />
        </div>
      </main>

      {/* Right thread strip */}
      <OtherThreadsStrip
        threads={snapshot?.threads ?? []}
        activeThreadId={activeThreadId}
      />
    </div>
  );
}
