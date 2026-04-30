import { useEffect } from 'react';
import { ChatThread } from '../components/ChatThread.js';
import { ChatComposer } from '../components/ChatComposer.js';
import { EmptyState } from '../components/EmptyState.js';
import { ThreadList } from '../components/ThreadList.js';
import { useMarqueeStore } from '../store/useMarqueeStore.js';

export function Workshop() {
  const memoryEmpty = useMarqueeStore((s) => s.memoryEmpty);
  const fetchInitialState = useMarqueeStore((s) => s.fetchInitialState);
  const sendMessage = useMarqueeStore((s) => s.sendMessage);
  const threads = useMarqueeStore((s) => s.threads);
  const threadId = useMarqueeStore((s) => s.threadId);
  const activeAgents = useMarqueeStore((s) => s.activeAgents);

  useEffect(() => {
    void fetchInitialState();
  }, [fetchInitialState]);

  if (memoryEmpty) {
    return (
      <EmptyState
        title="Üdv a Marquee-ban."
        body="Kezdjük az ügyfeled brand profiljának felépítésével. Beszélj a Directorral, ő végigvezet 6 kérdésen."
        actionLabel="Beszélgetés indítása"
        onAction={() => void sendMessage('Segíts beállítani az ügyfél profilját')}
      />
    );
  }

  return (
    <div className="flex flex-1 h-screen overflow-hidden">
      {/* Thread sidebar */}
      <ThreadList />

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Chat header */}
        <div className="px-4 py-3.5 border-b border-rule bg-cream flex items-center gap-2">
          <span className="text-[14px] font-bold text-ink-1">
            {threads.find((t) => t.id === threadId)?.title ?? 'Új beszélgetés'}
          </span>
          {activeAgents.has('director') && <span className="bulb ml-1" />}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto flex flex-col min-h-0">
          <ChatThread />
        </div>

        {/* Sticky composer */}
        <div className="shrink-0 pb-3 bg-gradient-to-t from-cream via-cream to-transparent pt-2">
          <ChatComposer />
        </div>
      </div>
    </div>
  );
}
