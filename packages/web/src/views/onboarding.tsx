import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { ChatInput } from "../components/chat/ChatInput";
import { MessageList } from "../components/chat/MessageList";
import { useAgencyStore } from "../store/useAgencyStore";

interface Message {
  id: string;
  sender: string;
  type: string;
  contentJson: Record<string, unknown>;
  createdAt: string | number;
}

export function OnboardingView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const setView = useAgencyStore((s) => s.setView);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const thread = await api.threads.create("Onboarding");
      setThreadId(thread.id);
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!threadId) return;
    setSending(true);
    try {
      await api.messages.post(threadId, text);
      const msgs = await api.threads.messages(threadId);
      setMessages(msgs);
    } finally {
      setSending(false);
    }
  };

  const handleApproveBrief = async (briefId: string) => {
    await api.briefs.dispatch(briefId);
    setView("home");
  };

  return (
    <div className="fixed inset-0 bg-[hsl(var(--background))] flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))]">
        <h1 className="font-serif text-xl font-semibold text-[hsl(var(--primary))]">marquee</h1>
        <button
          className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          onClick={() => setView("home")}
        >
          Skip to dashboard →
        </button>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col max-w-3xl mx-auto w-full">
        <div className="flex-1 overflow-hidden flex flex-col">
          <MessageList
            messages={messages}
            onApproveBrief={handleApproveBrief}
          />
          <div ref={bottomRef} />
        </div>
        <ChatInput onSubmit={handleSend} disabled={sending || !threadId} />
      </main>
    </div>
  );
}
