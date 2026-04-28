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

export function OnboardingView() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [inputText, setInputText] = useState("");
  const [preview, setPreview] = useState<{ clientProfile: string; brandGuidelines: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);
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

    unsubs.push(agencyEvents.on("onboarding_preview", (ev) => {
      const e = ev as { threadId?: string; clientProfile?: string; brandGuidelines?: string };
      if (e.threadId !== threadId) return;
      if (e.clientProfile && e.brandGuidelines) {
        setPreview({ clientProfile: e.clientProfile, brandGuidelines: e.brandGuidelines });
      }
    }));

    unsubs.push(agencyEvents.on("onboarding_complete", (ev) => {
      const e = ev as { threadId?: string };
      if (e.threadId !== threadId) return;
      setComplete(true);
    }));

    return () => unsubs.forEach((u) => u());
  }, [threadId]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, preview, typing, complete]);

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

  const allApproved = complete;

  async function handleSavePreview() {
    if (!preview) return;
    setSaving(true);
    try {
      await api.onboarding.save(preview.clientProfile, preview.brandGuidelines, threadId);
      setPreview(null);
      setComplete(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      height: "100vh",
      overflow: "hidden",
      background: "radial-gradient(ellipse at top, #F2EBDA 0%, #EFE8DA 60%)",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Top bar */}
      <div style={{ flexShrink: 0, padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--rule)" }}>
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

      {/* Center column */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 768, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Header */}
          <div style={{ flexShrink: 0, padding: "28px 32px 20px" }}>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>
              A marketing csapatod készen áll.
            </div>
            <div style={{ color: "var(--ink-2)", marginTop: 8, fontSize: 14, lineHeight: 1.5 }}>
              A Direktor feltesz néhány kérdést a közös memória felépítéséhez.
            </div>
          </div>

          <hr style={{ flexShrink: 0, border: "none", borderTop: "1px solid var(--rule)", margin: "0 32px" }} />

          {/* Messages — scrollable */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 32px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {msgs.map((m) => m.sender === "director" ? (
                <div key={m.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <Avatar who="director" size="sm" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Direktor</div>
                    <div style={{ fontSize: 15, lineHeight: 1.6, color: "var(--ink-1)", whiteSpace: "pre-wrap" }}>{m.text}</div>
                  </div>
                </div>
              ) : (
                <div key={m.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "flex-end" }}>
                  <div style={{ flex: 1, textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Te</div>
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
                  <div style={{ color: "var(--ink-3)", fontSize: 13, paddingTop: 4 }}>Gépel…</div>
                </div>
              )}

              {/* Onboarding preview — show before saving */}
              {preview && !complete && (
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <Avatar who="director" size="sm" />
                  <div style={{ flex: 1, border: "2px solid var(--secondary)", borderRadius: 6, background: "var(--white)", overflow: "hidden" }}>
                    <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--rule)", background: "var(--secondary-soft)" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--warning-deep)", fontFamily: "var(--font-mono)" }}>
                        ÜGYFÉLPROFIL · ELŐNÉZET
                      </span>
                    </div>
                    <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 4, fontFamily: "var(--font-mono)" }}>client_profile.md</div>
                        <textarea
                          value={preview.clientProfile}
                          onChange={(e) => setPreview({ ...preview, clientProfile: e.target.value })}
                          rows={6}
                          style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--rule)", borderRadius: 4, background: "var(--parchment)", fontSize: 12, fontFamily: "var(--font-mono)", resize: "vertical", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 4, fontFamily: "var(--font-mono)" }}>brand_guidelines.md</div>
                        <textarea
                          value={preview.brandGuidelines}
                          onChange={(e) => setPreview({ ...preview, brandGuidelines: e.target.value })}
                          rows={5}
                          style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--rule)", borderRadius: 4, background: "var(--parchment)", fontSize: 12, fontFamily: "var(--font-mono)", resize: "vertical", boxSizing: "border-box" }}
                        />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={handleSavePreview}
                          disabled={saving}
                          style={{ padding: "8px 20px", borderRadius: 4, border: "none", cursor: saving ? "default" : "pointer", background: "var(--bulb)", color: "#fff", fontSize: 13, fontWeight: 500 }}
                        >
                          {saving ? "Mentés…" : "Jóváhagyás & mentés"}
                        </button>
                        <button
                          onClick={() => setPreview(null)}
                          style={{ padding: "8px 14px", borderRadius: 4, border: "1px solid var(--rule)", cursor: "pointer", background: "transparent", color: "var(--ink-3)", fontSize: 13 }}
                        >
                          Elvetés
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}


              {allApproved && (
                <div style={{ display: "flex", justifyContent: "center", padding: "16px 0 8px" }}>
                  <button onClick={() => setView("home")} style={{ padding: "12px 32px", borderRadius: 4, border: "none", cursor: "pointer", background: "var(--bulb)", color: "#fff", fontSize: 15, fontWeight: 600 }}>
                    Tovább az irányítópultra →
                  </button>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input — fixed at bottom */}
          {!allApproved && (
            <div style={{ flexShrink: 0, padding: "12px 32px 20px" }}>
              <div style={{ padding: "10px 14px", background: "var(--white)", border: "1px solid var(--rule-strong)", borderRadius: 6 }}>
                <textarea
                  style={{
                    border: 0, padding: 4, width: "100%", resize: "none",
                    fontSize: 14, fontFamily: "inherit", background: "transparent", outline: "none",
                    minHeight: 40, maxHeight: 160, overflowY: "auto", display: "block",
                  }}
                  placeholder="Válasz a Direktornak…"
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  }}
                  disabled={sending || !threadId}
                  rows={1}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
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
