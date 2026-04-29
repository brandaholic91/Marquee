import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarqueeStore } from '../store/useMarqueeStore.js';
import { SendBackModal } from './SendBackModal.js';

interface DeliverableActionsProps {
  deliverableId: string;
}

export function DeliverableActions({ deliverableId }: DeliverableActionsProps) {
  const [showSendBack, setShowSendBack] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'approved' | 'discarded' | null>(null);
  const navigate = useNavigate();
  const approve = useMarqueeStore((s) => s.approveDeliverable);
  const discard = useMarqueeStore((s) => s.discardDeliverable);
  const returnFn = useMarqueeStore((s) => s.returnDeliverable);

  async function handleApprove() {
    setBusy(true);
    await approve(deliverableId);
    setDone('approved');
    setTimeout(() => navigate('/jovahagyas'), 900);
  }

  async function handleDiscard() {
    if (!confirm('Biztosan eldobod ezt a deliverable-t?')) return;
    setBusy(true);
    await discard(deliverableId);
    setDone('discarded');
    setTimeout(() => navigate('/jovahagyas'), 900);
  }

  return (
    <div className="flex gap-2 mt-6">
      <button
        className={`px-4 py-2 rounded-md font-medium disabled:opacity-50 transition-colors ${
          done === 'approved'
            ? 'bg-success-deep text-white'
            : 'bg-primary text-white hover:bg-primary-hover'
        }`}
        disabled={busy}
        onClick={handleApprove}
      >
        {done === 'approved' ? 'Jóváhagyva ✓' : 'Jóváhagy'}
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
        onClick={handleDiscard}
      >
        {done === 'discarded' ? 'Eldobva ✓' : 'Eldob'}
      </button>

      {showSendBack && (
        <SendBackModal
          onCancel={() => setShowSendBack(false)}
          onSubmit={async (note) => {
            setBusy(true);
            await returnFn(deliverableId, note);
            setBusy(false);
            setShowSendBack(false);
            navigate('/jovahagyas');
          }}
        />
      )}
    </div>
  );
}
