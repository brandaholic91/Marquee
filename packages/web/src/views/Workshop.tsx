import { useEffect, useRef, useState } from 'react';
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

  const [mobileThreadsOpen, setMobileThreadsOpen] = useState(false);
  const prevThreadId = useRef(threadId);

  useEffect(() => {
    void fetchInitialState();
  }, [fetchInitialState]);

  // Automatikusan bezárja a drawert ha thread változott
  useEffect(() => {
    if (prevThreadId.current !== threadId) {
      setMobileThreadsOpen(false);
      prevThreadId.current = threadId;
    }
  }, [threadId]);

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
      {/* Desktop thread sidebar */}
      <div className="hidden md:flex">
        <ThreadList />
      </div>

      {/* Mobile thread drawer — full screen */}
      {mobileThreadsOpen && (
        <div className="fixed inset-0 z-[70] md:hidden flex flex-col">
          <div className="flex items-center justify-between px-4 h-12 bg-sidebar-bg border-b border-sidebar-border shrink-0">
            <span className="text-sm font-semibold text-sidebar-text">Beszélgetések</span>
            <button
              onClick={() => setMobileThreadsOpen(false)}
              className="w-9 h-9 flex items-center justify-center text-sidebar-text text-2xl leading-none"
              aria-label="Bezárás"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ThreadList />
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Chat header */}
        <div className="px-4 py-3.5 border-b border-rule bg-cream flex items-center gap-2">
          {/* Left spacer mobilon a nav hamburger miatt */}
          <span className="md:hidden w-10 shrink-0" />
          <span className="flex-1 text-[14px] font-bold text-ink-1 truncate">
            {threads.find((t) => t.id === threadId)?.title ?? 'Új beszélgetés'}
          </span>
          {activeAgents.has('director') && <span className="bulb shrink-0" />}
          <button
            onClick={() => setMobileThreadsOpen(true)}
            className="md:hidden text-ink-2 text-[20px] leading-none px-1 shrink-0"
            aria-label="Beszélgetések"
          >
            ☰
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto flex flex-col min-h-0 pb-24">
          <div className="w-full max-w-4xl mx-auto">
            <ChatThread />
          </div>
        </div>

        {/* Sticky composer */}
        <div className="sticky bottom-0 pb-3 bg-gradient-to-t from-cream via-cream to-transparent pt-2">
          <div className="max-w-4xl mx-auto">
            <ChatComposer />
          </div>
        </div>
      </div>
    </div>
  );
}
