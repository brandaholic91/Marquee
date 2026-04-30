import { useState, type KeyboardEvent } from 'react';
import { useMarqueeStore } from '../store/useMarqueeStore.js';
import { BulbIndicator } from './BulbIndicator.js';

export function ChatComposer({ placeholder = 'Írj a Directornak…' }: { placeholder?: string }) {
  const [text, setText] = useState('');
  const sendMessage = useMarqueeStore((s) => s.sendMessage);
  const activeAgents = useMarqueeStore((s) => s.activeAgents);

  const directorThinking = activeAgents.has('director');

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    await sendMessage(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <div className="mx-4 mb-3 bg-off-white border border-rule rounded-[16px] shadow-composer">
      {directorThinking && (
        <div className="flex items-center gap-2 px-3 pt-2 text-xs text-ink-2">
          <BulbIndicator active={true} />
          <span>Director gondolkodik...</span>
        </div>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={2}
        className="textarea-chat w-full min-h-[52px] rounded-t-[16px] resize-none bg-transparent px-3 pt-3 pb-2 text-sm text-ink-1 placeholder:text-ink-3 focus:outline-none"
        disabled={directorThinking}
      />
      <div className="flex items-center justify-end px-3 py-2 border-t border-parchment">
        <button
          onClick={() => void handleSubmit()}
          disabled={directorThinking || !text.trim()}
          className="bg-primary text-sidebar-bg text-[13px] font-bold px-[18px] py-2 rounded-btn flex items-center gap-1.5 disabled:opacity-40"
        >
          Küldés
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
