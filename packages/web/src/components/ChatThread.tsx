import { useEffect, useRef } from 'react';
import { useMarqueeStore, type Message, type ProposedBrief } from '../store/useMarqueeStore.js';
import { BriefProposalCard } from './BriefProposalCard.js';

function ChatBubble({ message }: { message: Message }) {
  const isUser = message.sender === 'user';

  if (message.type === 'system') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-ink-2">{message.text}</span>
      </div>
    );
  }

  if (message.type === 'tool_call') {
    return (
      <div className="flex justify-start my-1">
        <span className="text-xs text-ink-2 italic">Director hívja: {message.toolName}</span>
      </div>
    );
  }

  if (message.type === 'tool_result') {
    return null;
  }

  if (message.type === 'memory_proposal') {
    return (
      <div className="flex justify-start my-2">
        <div className="bg-off-white border border-rule rounded-lg px-4 py-2 text-sm text-ink-2 max-w-md">
          Új memória javaslat — lásd Memória nézet
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} my-2`}>
      <div
        className={`max-w-[70%] px-4 py-3 rounded-lg text-sm leading-relaxed ${
          isUser
            ? 'bg-primary-soft text-ink-1'
            : 'bg-off-white border border-rule text-ink-1'
        }`}
      >
        {message.text}
      </div>
    </div>
  );
}

export function ChatThread() {
  const messages = useMarqueeStore((s) => s.messages);
  const proposedBriefs = useMarqueeStore((s) => s.proposedBriefs);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Build a lookup map for proposed briefs by briefId
  const briefMap = new Map<string, ProposedBrief>(
    proposedBriefs.map((b) => [b.briefId, b]),
  );

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {messages.map((msg) => {
        if (msg.type === 'brief_proposal' && msg.briefId) {
          const brief = briefMap.get(msg.briefId);
          if (!brief) return null;
          return (
            <BriefProposalCard
              key={msg.id}
              briefId={brief.briefId}
              title={brief.title}
              contentMd={brief.contentMd}
              deliverableType={brief.deliverableType}
              targetSpecialist={brief.targetSpecialist}
              platform={brief.platform}
              campaignName={brief.campaignName}
            />
          );
        }
        return <ChatBubble key={msg.id} message={msg} />;
      })}
      <div ref={bottomRef} />
    </div>
  );
}
