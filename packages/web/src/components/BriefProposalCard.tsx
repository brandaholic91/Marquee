import { useState } from 'react';
import { useMarqueeStore } from '../store/useMarqueeStore.js';

export function BriefProposalCard({
  briefId,
  title,
  contentMd,
  deliverableType,
  targetSpecialist,
  platform,
}: {
  briefId: string;
  title: string;
  contentMd: string;
  deliverableType: string;
  targetSpecialist: string;
  platform?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
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

      {contentMd && (
        <div className="mt-3">
          <button
            className="text-xs text-primary-hover hover:underline"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? '▲ Brief elrejtése' : '▼ Brief megtekintése'}
          </button>
          {expanded && (
            <pre className="mt-2 text-sm text-ink-1 bg-cream border border-rule rounded p-3 whitespace-pre-wrap font-sans max-h-64 overflow-y-auto">
              {contentMd}
            </pre>
          )}
        </div>
      )}

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
