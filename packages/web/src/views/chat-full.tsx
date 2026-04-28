import { useState, useEffect, useRef, type ReactNode } from "react";
import { agencyEvents } from "../lib/sse.js";
import { api } from "../lib/api.js";
import { useAgencyStore } from "../store/useAgencyStore.js";
import { Avatar, AgentBadge, Bulb } from "../components/ui/index.js";
import { Sidebar } from "../components/layout/Sidebar.js";
import type { AvatarWho } from "../components/ui/index.js";

// ---- Types ----

// Shape returned by the DB / API
interface RawMessage {
  id: string;
  sender: string;          // "human" | agent slug
  type: string;
  contentJson: { text?: string } | string | null;
  agentSlug?: string;
  createdAt: string;
}

// Normalised shape used for rendering
interface Message {
  id: string;
  role: "user" | "assistant" | "event";
  text: string;
  agentSlug?: string;
  createdAt: string;
}

function normaliseMessage(raw: RawMessage): Message {
  const content = typeof raw.contentJson === "string"
    ? (JSON.parse(raw.contentJson) as { text?: string })
    : (raw.contentJson ?? {});
  const text = (content as { text?: string }).text ?? "";
  const role: Message["role"] =
    raw.sender === "human" ? "user"
    : raw.type === "chat" ? "assistant"
    : "event";
  return {
    id: raw.id,
    role,
    text,
    agentSlug: raw.sender !== "human" ? raw.sender : undefined,
    createdAt: raw.createdAt,
  };
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

  const isHuman = who === "human";

  return (
    <div style={{ display: "flex", gap: 14, flexDirection: isHuman ? "row-reverse" : "row" }}>
      <Avatar who={safeWho} size="md" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
            flexDirection: isHuman ? "row-reverse" : "row",
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
        <div className="body-md" style={isHuman ? { textAlign: "right" } : undefined}>{children}</div>
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

// ---- TypingBubble ----

function TypingBubble({ agentSlug }: { agentSlug: string }) {
  const name = agentSlug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  const safeWho: AvatarWho = (agentSlug as AvatarWho) in { human: 1, director: 1, "content-lead": 1, copywriter: 1, "eval-judge": 1, analytics: 1, "distribution-lead": 1, "insights-lead": 1 }
    ? (agentSlug as AvatarWho)
    : "director";
  return (
    <>
      <style>{`
        @keyframes mq-dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        .mq-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--ink-3); margin: 0 2px; animation: mq-dot-bounce 1.2s infinite ease-in-out; }
        .mq-dot:nth-child(2) { animation-delay: 0.2s; }
        .mq-dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>
      <div style={{ display: "flex", gap: 14 }}>
        <Avatar who={safeWho} size="md" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{name}</span>
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center",
            padding: "8px 14px",
            background: "var(--parchment)",
            border: "1px solid var(--rule)",
            borderRadius: 12,
          }}>
            <span className="mq-dot" />
            <span className="mq-dot" />
            <span className="mq-dot" />
          </div>
        </div>
      </div>
    </>
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
  const [sendError, setSendError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await api.messages.post(threadId, trimmed);
      setSendError(null);
      setText("");
      onSent();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send message");
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
        {sendError && (
          <div style={{ color: "var(--danger-deep)", fontSize: 12, marginTop: 4 }}>{sendError}</div>
        )}
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
  const [typingAgent, setTypingAgent] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeThread =
    snapshot?.threads.find((t) => t.id === activeThreadId) ?? null;

  useEffect(() => {
    api.snapshot().then((data) => setSnapshot(data as SnapshotData)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!activeThreadId) return;
    const load = () => {
      setLoading(true);
      api.threads.messages(activeThreadId).then((data) => {
        setMessages((data as RawMessage[]).map(normaliseMessage));
        setLoading(false);
      }).catch((err) => { console.error(err); setLoading(false); });
    };
    setMessages([]);
    load();
  }, [activeThreadId]);

  const refreshMessages = () => {
    if (!activeThreadId) return;
    api.threads.messages(activeThreadId).then((data) => {
      setMessages((data as RawMessage[]).map(normaliseMessage));
    }).catch(console.error);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-refresh messages when agent replies + show typing indicator
  useEffect(() => {
    if (!activeThreadId) return;
    agencyEvents.start();
    const unsubMsg = agencyEvents.on("agent_message", (ev) => {
      const e = ev as { threadId?: string };
      if (e.threadId === activeThreadId) {
        setTypingAgent(null);
        refreshMessages();
      }
    });
    const unsubTyping = agencyEvents.on("agent_typing", (ev) => {
      const e = ev as { threadId?: string; agentSlug?: string };
      if (e.threadId === activeThreadId) setTypingAgent(e.agentSlug ?? "director");
    });
    return () => { unsubMsg(); unsubTyping(); agencyEvents.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId]);

  if (!activeThreadId) {
    return (
      <div
        style={{
          display: "flex",
          height: "100%",
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
        height: "100%",
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
                onRefresh={refreshMessages}
              />
            ))}
            {typingAgent && (
              <TypingBubble agentSlug={typingAgent} />
            )}
            <div ref={bottomRef} />
          </div>

          {/* Sticky input */}
          <StickyInput threadId={activeThreadId} onSent={refreshMessages} />
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
