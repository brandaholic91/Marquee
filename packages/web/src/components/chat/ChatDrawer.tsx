import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { useAgencyStore } from "../../store/useAgencyStore";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";

interface Message {
  id: string; sender: string; type: string; contentJson: Record<string, unknown>; createdAt: string | number;
}

export function ChatDrawer() {
  const { activeThreadId, drawerOpen, setDrawerOpen } = useAgencyStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (activeThreadId) {
      api.threads.messages(activeThreadId).then(setMessages);
    }
  }, [activeThreadId]);

  if (!drawerOpen) return null;

  const handleSend = async (text: string) => {
    if (!activeThreadId) return;
    setSending(true);
    try {
      await api.messages.post(activeThreadId, text);
      const msgs = await api.threads.messages(activeThreadId);
      setMessages(msgs);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-[hsl(var(--card))] border-l border-[hsl(var(--border))] flex flex-col shadow-xl z-50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
        <span className="font-medium text-sm">Chat</span>
        <button
          className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] text-lg"
          onClick={() => setDrawerOpen(false)}
        >
          ×
        </button>
      </div>
      <MessageList messages={messages} />
      <ChatInput onSubmit={handleSend} disabled={sending || !activeThreadId} />
    </div>
  );
}
