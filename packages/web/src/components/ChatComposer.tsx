import { useState, type KeyboardEvent } from 'react';
import { useMarqueeStore } from '../store/useMarqueeStore.js';
import { BulbIndicator } from './BulbIndicator.js';

export function ChatComposer() {
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
    <div className="border-t border-rule bg-white px-4 py-3">
      {directorThinking && (
        <div className="flex items-center gap-2 mb-2 text-xs text-ink-2">
          <BulbIndicator active={true} />
          <span>Director gondolkodik...</span>
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          className="flex-1 resize-none border border-rule rounded-lg px-3 py-2 text-sm text-ink-1 placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px] max-h-32"
          placeholder="Írj egy üzenetet..."
          value={text}
          rows={1}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-hover disabled:opacity-50 shrink-0 h-[44px]"
          onClick={() => void handleSubmit()}
          disabled={!text.trim()}
        >
          Küld
        </button>
      </div>
    </div>
  );
}
