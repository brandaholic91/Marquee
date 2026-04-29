import { useState } from 'react';
import { useMarqueeStore } from '../store/useMarqueeStore.js';
import { SendBackModal } from './SendBackModal.js';

interface DeliverableActionsProps {
  deliverableId: string;
}

export function DeliverableActions({ deliverableId }: DeliverableActionsProps) {
  const [showSendBack, setShowSendBack] = useState(false);
  const [busy, setBusy] = useState(false);
  const approve = useMarqueeStore((s) => s.approveDeliverable);
  const discard = useMarqueeStore((s) => s.discardDeliverable);
  const returnFn = useMarqueeStore((s) => s.returnDeliverable);

  return (
    <div className="flex gap-2 mt-6">
      <button
        className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-hover disabled:opacity-50"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await approve(deliverableId);
          setBusy(false);
        }}
      >
        Jóváhagy
      </button>
      <button
        className="border border-rule-strong px-4 py-2 rounded-md text-ink-1 hover:bg-cream disabled:opacity-50"
        disabled={busy}
        onClick={() => setShowSendBack(true)}
      >
        Visszaküld javításra
      </button>
      <button
        className="px-3 py-2 rounded-md text-ink-2 hover:bg-cream disabled:opacity-50"
        disabled={busy}
        onClick={async () => {
          if (!confirm('Biztosan eldobod ezt a deliverable-t?')) return;
          setBusy(true);
          await discard(deliverableId);
          setBusy(false);
        }}
      >
        Eldob
      </button>

      {showSendBack && (
        <SendBackModal
          onCancel={() => setShowSendBack(false)}
          onSubmit={async (note) => {
            setBusy(true);
            await returnFn(deliverableId, note);
            setBusy(false);
            setShowSendBack(false);
          }}
        />
      )}
    </div>
  );
}
