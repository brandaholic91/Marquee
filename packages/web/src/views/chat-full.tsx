import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { MessageList } from "../components/chat/MessageList";
import { ChatInput } from "../components/chat/ChatInput";

interface Message {
  id: string; sender: string; type: string; contentJson: Record<string, unknown>; createdAt: string | number;
}

interface ChatFullViewProps {
  threadId: string;
}

export function ChatFullView({ threadId }: ChatFullViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.threads.messages(threadId).then(setMessages);
  }, [threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text: string) => {
    setSending(true);
    try {
      await api.messages.post(threadId, text);
      const msgs = await api.threads.messages(threadId);
      setMessages(msgs);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
      <div className="flex-1 overflow-hidden flex flex-col">
        <MessageList messages={messages} />
        <div ref={bottomRef} />
      </div>
      <ChatInput onSubmit={handleSend} disabled={sending} />
    </div>
  );
}
