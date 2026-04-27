interface Message {
  id: string;
  sender: string;
  type: string;
  contentJson: Record<string, unknown>;
  createdAt: string | number;
}

interface MessageListProps {
  messages: Message[];
  onApproveBrief?: (briefId: string) => void;
  onApproveMemory?: (proposalId: string) => void;
}

export function MessageList({ messages, onApproveBrief, onApproveMemory }: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map((msg) => (
        <MessageItem
          key={msg.id}
          msg={msg}
          onApproveBrief={onApproveBrief}
          onApproveMemory={onApproveMemory}
        />
      ))}
    </div>
  );
}

function MessageItem({ msg, onApproveBrief, onApproveMemory }: {
  msg: Message;
  onApproveBrief?: (id: string) => void;
  onApproveMemory?: (id: string) => void;
}) {
  const isHuman = msg.sender === "human";
  const content = msg.contentJson;

  if (msg.type === "brief_proposal" && content.briefId) {
    return (
      <div className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Brief proposal</div>
        <div className="font-medium">{String(content.title ?? "")}</div>
        <div className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{String(content.scope ?? "")}</div>
        <button
          className="mt-3 text-sm text-[hsl(var(--primary))] hover:underline"
          onClick={() => onApproveBrief?.(String(content.briefId))}
        >
          Approve &amp; dispatch →
        </button>
      </div>
    );
  }

  return (
    <div className={`flex ${isHuman ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded px-3 py-2 text-sm ${
          isHuman
            ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
            : "bg-[hsl(var(--card))] border border-[hsl(var(--border))]"
        }`}
      >
        {!isHuman && (
          <div className="text-xs opacity-60 mb-1">{msg.sender}</div>
        )}
        <div>{String(content.text ?? JSON.stringify(content))}</div>
      </div>
    </div>
  );
}
