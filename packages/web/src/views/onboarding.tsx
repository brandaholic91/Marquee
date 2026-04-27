import { useState, useEffect, useRef } from "react";
import { Avatar } from "../components/ui/index.js";
import { useAgencyStore } from "../store/useAgencyStore.js";

// ── Types ──────────────────────────────────────────────────────────────────

interface ChatMsg {
  role: "director" | "user";
  text: string;
}

// ── Scripted conversation ──────────────────────────────────────────────────

const DIRECTOR_QUESTIONS = [
  "What's your company or product name?",
  "Who is your ideal customer? Describe them in a sentence.",
  "What's your main value proposition — what do you help them do faster, better, or cheaper?",
  "Finally, how would you describe your brand voice? (e.g. data-driven and direct, friendly and encouraging, authoritative)",
];

// ── Sub-components ─────────────────────────────────────────────────────────

function WelcomeHeader() {
  return (
    <div>
      <div className="display-lg">Your marketing team is ready.</div>
      <div
        className="body-md"
        style={{ color: "var(--ink-2)", marginTop: 12, maxWidth: 560 }}
      >
        Let's set up your workspace. I'll ask a few questions to build a shared
        memory your agents will use on every campaign.
      </div>
    </div>
  );
}

interface OMsgProps {
  text: string;
}

function OMsg({ text }: OMsgProps) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <Avatar who="director" size="sm" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600 }}>Director</span>
        </div>
        <div className="body-md" style={{ color: "var(--ink-1)" }}>
          {text}
        </div>
      </div>
    </div>
  );
}

interface UserMsgProps {
  text: string;
}

function UserMsg({ text }: UserMsgProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        justifyContent: "flex-end",
      }}
    >
      <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            marginBottom: 4,
            justifyContent: "flex-end",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600 }}>You</span>
        </div>
        <div
          className="body-md"
          style={{
            color: "var(--ink-1)",
            background: "var(--white)",
            border: "1px solid var(--rule)",
            borderRadius: 6,
            padding: "8px 12px",
            display: "inline-block",
            maxWidth: "80%",
            textAlign: "left",
          }}
        >
          {text}
        </div>
      </div>
      <Avatar who="human" size="sm" />
    </div>
  );
}

interface MemoryProposalCardProps {
  answers: string[];
  onApprove: () => void;
  onEdit: () => void;
  onDiscard: () => void;
}

function MemoryProposalCard({
  answers,
  onApprove,
  onEdit,
  onDiscard,
}: MemoryProposalCardProps) {
  const yaml = [
    `client_name: ${answers[0] ?? ""}`,
    `icp: ${answers[1] ?? ""}`,
    `usp: ${answers[2] ?? ""}`,
    `brand_voice: ${answers[3] ?? ""}`,
  ].join("\n");

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <Avatar who="director" size="sm" />
      <div style={{ flex: 1 }}>
        <div
          className="card"
          style={{
            border: "2px solid var(--secondary)",
            borderRadius: 6,
            background: "var(--white)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              borderBottom: "1px solid var(--rule)",
              background: "var(--secondary-soft)",
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--warning-deep)",
                letterSpacing: "0.08em",
                fontWeight: 600,
              }}
            >
              MEMORY · PROPOSAL
            </span>
            <span
              className="body-sm"
              style={{ color: "var(--warning-deep)", marginLeft: "auto" }}
            >
              director · just now
            </span>
          </div>
          <div style={{ padding: 20 }}>
            <div className="title-md">Client profile draft</div>
            <p className="body-md" style={{ color: "var(--ink-2)", marginTop: 6 }}>
              I'll save this to{" "}
              <code
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  color: "var(--ink-1)",
                }}
              >
                client_profile.md
              </code>{" "}
              so the team can reference it on every campaign.
            </p>

            <pre
              className="mono"
              style={{
                marginTop: 16,
                padding: "12px 16px",
                background: "var(--parchment, #F2EBDA)",
                borderRadius: 4,
                fontSize: 12,
                lineHeight: 1.7,
                color: "var(--ink-1)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {yaml}
            </pre>

            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button className="btn btn-primary" onClick={onApprove}>
                Approve &amp; save
              </button>
              <button className="btn btn-secondary" onClick={onEdit}>
                Edit
              </button>
              <button className="btn btn-ghost" onClick={onDiscard}>
                Discard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ReplyInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
}

function ReplyInput({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = "Reply to Director…",
}: ReplyInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSend();
    }
  };

  return (
    <div style={{ position: "sticky", bottom: 24, marginTop: 24, paddingBottom: 24 }}>
      <div
        className="card"
        style={{
          padding: 14,
          background: "var(--white)",
          borderColor: "var(--rule-strong)",
        }}
      >
        <textarea
          className="textarea-chat"
          style={{ border: 0, padding: 4, minHeight: 56, width: "100%", resize: "none" }}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 8,
          }}
        >
          <div className="body-sm muted">⏎ to send</div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={onSend}
            disabled={disabled || !value.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────

export function OnboardingView() {
  const [step, setStep] = useState(0); // 0=welcome, 1-4=questions, 5=proposal
  const [answers, setAnswers] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputText, setInputText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const setView = useAgencyStore((s) => s.setView);

  // Kick off first question when the component mounts
  useEffect(() => {
    setTimeout(() => {
      setMessages([{ role: "director", text: DIRECTOR_QUESTIONS[0] }]);
      setStep(1);
    }, 400);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;

    // Add user message
    const newAnswers = [...answers, text];
    setAnswers(newAnswers);
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInputText("");

    const nextStep = step + 1;
    setStep(nextStep);

    if (nextStep <= 4) {
      // Show next question after short delay
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { role: "director", text: DIRECTOR_QUESTIONS[nextStep - 1] },
        ]);
      }, 500);
    }
    // step 5 = proposal card, no additional director message needed
  };

  const handleApprove = async () => {
    const profile = {
      client_name: answers[0] ?? "",
      icp: answers[1] ?? "",
      usp: answers[2] ?? "",
      brand_voice: answers[3] ?? "",
    };
    try {
      await fetch("/api/memory/files", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: "client_profile.md", content: profile }),
      });
    } catch {
      // best-effort — proceed regardless
    }
    setView("home");
  };

  const handleDiscard = () => {
    setAnswers([]);
    setInputText("");
    setStep(0);
    setMessages([]);
    setTimeout(() => {
      setMessages([{ role: "director", text: DIRECTOR_QUESTIONS[0] }]);
      setStep(1);
    }, 400);
  };

  const handleEdit = () => {
    // Drop back to step 4 so user can re-answer the last question
    const trimmedAnswers = answers.slice(0, 3);
    setAnswers(trimmedAnswers);
    const trimmedMessages = messages.slice(0, messages.length - 1); // remove last user msg
    setMessages(trimmedMessages);
    setStep(4);
    setInputText(answers[3] ?? "");
  };

  const showProposal = step === 5;
  const inputDisabled = showProposal;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(ellipse at top, #F2EBDA 0%, #EFE8DA 60%)`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Slim top bar */}
      <div
        style={{
          padding: "24px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          className="mono"
          style={{ fontSize: 12, letterSpacing: "0.12em", color: "var(--ink-2)" }}
        >
          MARQUEE
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setView("home")}
          style={{ fontSize: 13 }}
        >
          Skip to dashboard →
        </button>
      </div>

      {/* Centered chat container */}
      <div
        style={{ flex: 1, display: "flex", justifyContent: "center", padding: "32px 32px 0" }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 768,
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <WelcomeHeader />

          <hr className="hr" />

          {/* Message thread */}
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {messages.map((m, i) =>
              m.role === "director" ? (
                <OMsg key={i} text={m.text} />
              ) : (
                <UserMsg key={i} text={m.text} />
              ),
            )}

            {showProposal && (
              <MemoryProposalCard
                answers={answers}
                onApprove={handleApprove}
                onEdit={handleEdit}
                onDiscard={handleDiscard}
              />
            )}

            <div ref={bottomRef} />
          </div>

          {/* Sticky reply input */}
          {!showProposal && (
            <ReplyInput
              value={inputText}
              onChange={setInputText}
              onSend={handleSend}
              disabled={inputDisabled}
            />
          )}
        </div>
      </div>
    </div>
  );
}
