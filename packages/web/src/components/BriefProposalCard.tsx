import { useState } from 'react';
import { useMarqueeStore } from '../store/useMarqueeStore.js';

export function BriefProposalCard({
  briefId,
  title,
  deliverableType,
  targetSpecialist,
  platform,
}: {
  briefId: string;
  title: string;
  deliverableType: string;
  targetSpecialist: string;
  platform?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const dispatchBrief = useMarqueeStore((s) => s.dispatchBrief);
  const discardBrief = useMarqueeStore((s) => s.discardBrief);

  return (
    <div className="border-2 border-primary rounded-lg p-6 bg-off-white my-3">
      <h3 className="font-serif text-lg font-semibold">{title}</h3>
      <div className="text-sm text-ink-2 mt-1">
        Deliverable: <strong>{deliverableType}</strong>
        {platform && <span> · platform: {platform}</span>}
        <br />
        Specialista: <strong>{targetSpecialist}</strong>
      </div>
      <div className="flex gap-2 mt-4">
        <button
          className="bg-primary text-white px-4 py-2 rounded-md disabled:opacity-50 hover:bg-primary-hover"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await dispatchBrief(briefId);
            setBusy(false);
          }}
        >
          Jóváhagy &amp; dispatch
        </button>
        <button
          className="border border-rule-strong px-4 py-2 rounded-md text-ink-1"
          disabled={busy}
        >
          Szerkeszt
        </button>
        <button
          className="px-3 py-2 rounded-md text-ink-2 hover:bg-cream"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await discardBrief(briefId);
            setBusy(false);
          }}
        >
          Eldob
        </button>
      </div>
    </div>
  );
}
