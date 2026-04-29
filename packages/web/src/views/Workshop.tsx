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
    <div className="flex h-[calc(100vh-100px)] -mx-8">
      <ThreadList />
      <div className="flex flex-col flex-1 min-w-0 px-6">
        <ChatThread />
        <ChatComposer />
      </div>
    </div>
  );
}
