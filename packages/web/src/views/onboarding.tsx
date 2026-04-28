import { useState, useEffect, useRef } from "react";
import { Avatar } from "../components/ui/index.js";
import { api } from "../lib/api.js";
import { agencyEvents } from "../lib/sse.js";
import { useAgencyStore } from "../store/useAgencyStore.js";

interface Msg {
  id: string;
  sender: "human" | "director";
  text: string;
}

interface Proposal {
  id: string;
  file: string;
  patch: string;
  status: "pending" | "approved" | "rejected";
}

export function OnboardingView() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [inputText, setInputText] = useState("");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const setView = useAgencyStore((s) => s.setView);

  // Start SSE + onboarding thread on mount
  useEffect(() => {
    agencyEvents.start();
    api.onboarding.start().then(({ threadId: tid }) => {
      setThreadId(tid);
    }).catch(console.error);
  }, []);

  // Subscribe to SSE events once we have a threadId
  useEffect(() => {
    if (!threadId) return;

    const unsubs: (() => void)[] = [];

    unsubs.push(agencyEvents.on("agent_message", (ev) => {
      const e = ev as { threadId?: string; text?: string; agentSlug?: string };
      if (e.threadId !== threadId) return;
      setTyping(false);
      // Strip any tool-call narration the model might prepend (e.g. use_skill("onboarding"))
      const raw = e.text ?? "";
      const text = raw.replace(/^(\s*use_skill\s*\([^)]*\)\s*)+/i, "").trim();
      if (!text) return;
      setMsgs((prev) => [...prev, {
        id: Math.random().toString(36).slice(2),
        sender: "director",
        text,
      }]);
    }));

    unsubs.push(agencyEvents.on("agent_typing", (ev) => {
      const e = ev as { threadId?: string };
      if (e.threadId === threadId) setTyping(true);
    }));

    unsubs.push(agencyEvents.on("memory_proposed", (ev) => {
      const e = ev as { proposalId?: string; file?: string };
      if (!e.proposalId) return;
      // Fetch full proposal details
      fetch("/api/memory-proposals").then((r) => r.json()).then((all: Proposal[]) => {
        const p = all.find((x) => x.id === e.proposalId);
        if (p) setProposals((prev) => [...prev.filter((x) => x.id !== p.id), p]);
      }).catch(() => {});
    }));

    return () => unsubs.forEach((u) => u());
  }, [threadId]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, proposals, typing]);

  async function handleSend() {
    const text = inputText.trim();
    if (!text || !threadId || sending) return;
    setSending(true);
    setInputText("");
    setMsgs((prev) => [...prev, {
      id: Math.random().toString(36).slice(2),
      sender: "human",
      text,
    }]);
    try {
      await api.messages.post(threadId, text);
    } finally {
      setSending(false);
    }
  }

  async function handleApprove(proposalId: string) {
    await api.memory.approve(proposalId).catch(() => {});
    setProposals((prev) => prev.map((p) => p.id === proposalId ? { ...p, status: "approved" } : p));
  }

  async function handleReject(proposalId: string) {
    await api.memory.reject(proposalId).catch(() => {});
    setProposals((prev) => prev.map((p) => p.id === proposalId ? { ...p, status: "rejected" } : p));
  }

  const allApproved = proposals.length > 0 && proposals.every((p) => p.status === "approved");

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at top, #F2EBDA 0%, #EFE8DA 60%)",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Top bar */}
      <div style={{ padding: "24px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 12, letterSpacing: "0.12em", color: "var(--ink-2)", fontFamily: "var(--font-mono)" }}>
          MARQUEE
        </div>
        <button
          onClick={() => setView("home")}
          style={{ fontSize: 13, background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)" }}
        >
          Ugrás az irányítópultra →
        </button>
      </div>

      {/* Chat container */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "32px 32px 0" }}>
        <div style={{ width: "100%", maxWidth: 768, display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Header */}
          <div>
            <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em" }}>
              A marketing csapatod készen áll.
            </div>
            <div style={{ color: "var(--ink-2)", marginTop: 12, maxWidth: 560, fontSize: 15, lineHeight: 1.5 }}>
              A Direktor feltesz néhány kérdést, hogy felépítse azt a közös memóriát, amit az agensek minden kampányban használnak majd.
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid var(--rule)" }} />

          {/* Messages */}
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {msgs.map((m) => m.sender === "director" ? (
              <div key={m.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <Avatar who="director" size="sm" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Director</div>
                  <div style={{ fontSize: 15, lineHeight: 1.6, color: "var(--ink-1)", whiteSpace: "pre-wrap" }}>{m.text}</div>
                </div>
              </div>
            ) : (
              <div key={m.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "flex-end" }}>
                <div style={{ flex: 1, textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>You</div>
                  <div style={{
                    fontSize: 15, lineHeight: 1.6, color: "var(--ink-1)",
                    background: "var(--white)", border: "1px solid var(--rule)",
                    borderRadius: 6, padding: "8px 12px", display: "inline-block", maxWidth: "80%", textAlign: "left",
                  }}>
                    {m.text}
                  </div>
                </div>
                <Avatar who="human" size="sm" />
              </div>
            ))}

            {typing && (
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <Avatar who="director" size="sm" />
                <div style={{ color: "var(--ink-3)", fontSize: 13, paddingTop: 4 }}>Typing…</div>
              </div>
            )}

            {/* Memory proposals */}
            {proposals.map((p) => (
              <div key={p.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <Avatar who="director" size="sm" />
                <div style={{
                  flex: 1, border: "2px solid var(--secondary)", borderRadius: 6,
                  background: "var(--white)", overflow: "hidden",
                }}>
                  <div style={{
                    padding: "12px 16px", display: "flex", alignItems: "center", gap: 8,
                    borderBottom: "1px solid var(--rule)", background: "var(--secondary-soft)",
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--warning-deep)", fontFamily: "var(--font-mono)" }}>
                      MEMORY · PROPOSAL
                    </span>
                    <span style={{ fontSize: 12, color: "var(--ink-3)", marginLeft: "auto" }}>{p.file}</span>
                  </div>
                  <div style={{ padding: 16 }}>
                    <pre style={{
                      padding: "10px 14px", background: "var(--parchment)", borderRadius: 4,
                      fontSize: 12, lineHeight: 1.7, color: "var(--ink-1)", whiteSpace: "pre-wrap", wordBreak: "break-word",
                      margin: 0,
                    }}>
                      {p.patch}
                    </pre>
                    {p.status === "pending" && (
                      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                        <button
                          onClick={() => handleApprove(p.id)}
                          style={{ padding: "7px 18px", borderRadius: 4, border: "none", cursor: "pointer", background: "var(--bulb)", color: "#fff", fontSize: 13, fontWeight: 500 }}
                        >
                          Jóváhagyás &amp; mentés
                        </button>
                        <button
                          onClick={() => handleReject(p.id)}
                          style={{ padding: "7px 14px", borderRadius: 4, border: "1px solid var(--rule)", cursor: "pointer", background: "transparent", color: "var(--ink-3)", fontSize: 13 }}
                        >
                          Elutasítás
                        </button>
                      </div>
                    )}
                    {p.status === "approved" && (
                      <div style={{ marginTop: 10, fontSize: 13, color: "var(--success, #2d7a4f)", fontWeight: 500 }}>✓ Saved</div>
                    )}
                    {p.status === "rejected" && (
                      <div style={{ marginTop: 10, fontSize: 13, color: "var(--ink-3)" }}>Rejected</div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Setup complete CTA */}
            {allApproved && (
              <div style={{ display: "flex", justifyContent: "center", padding: "16px 0 32px" }}>
                <button
                  onClick={() => setView("home")}
                  style={{ padding: "12px 32px", borderRadius: 4, border: "none", cursor: "pointer", background: "var(--bulb)", color: "#fff", fontSize: 15, fontWeight: 600 }}
                >
                  Tovább az irányítópultra →
                </button>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          {!allApproved && (
            <div style={{ position: "sticky", bottom: 24, marginTop: 8, paddingBottom: 24 }}>
              <div style={{ padding: 14, background: "var(--white)", border: "1px solid var(--rule-strong)", borderRadius: 6 }}>
                <textarea
                  style={{ border: 0, padding: 4, minHeight: 56, width: "100%", resize: "none", fontSize: 14, fontFamily: "inherit", background: "transparent", outline: "none" }}
                  placeholder="Válasz a Direktornak…"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  }}
                  disabled={sending || !threadId}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--ink-3)" }}>⏎ küldés</span>
                  <button
                    onClick={handleSend}
                    disabled={sending || !inputText.trim() || !threadId}
                    style={{ padding: "6px 16px", borderRadius: 4, border: "1px solid var(--rule)", cursor: "pointer", background: "transparent", fontSize: 13 }}
                  >
                    Küldés
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
