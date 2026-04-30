import { useState } from 'react';

interface Proposal {
  id: string;
  file: string;
  newContent: string;
  reason: string | null;
  createdAt: number;
}

export function MemoryProposalCard({
  proposal, onApprove, onReject,
}: {
  proposal: Proposal;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const preview = proposal.newContent.slice(0, 200);

  return (
    <div className="border-[1.5px] border-primary rounded-lg p-4 bg-off-white my-3">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold">Memória javaslat: <code className="font-mono text-sm">{proposal.file}</code></h4>
          {proposal.reason && <p className="text-sm text-ink-2 mt-1">{proposal.reason}</p>}
        </div>
        <span className="text-xs text-ink-2">{new Date(proposal.createdAt).toLocaleString('hu-HU')}</span>
      </div>

      <pre className={`mt-3 p-3 bg-parchment rounded-md text-xs whitespace-pre-wrap font-mono ${expanded ? '' : 'max-h-32 overflow-hidden'}`}>
        {expanded ? proposal.newContent : preview + (proposal.newContent.length > 200 ? '…' : '')}
      </pre>
      {proposal.newContent.length > 200 && (
        <button
          className="mt-1 text-xs text-primary hover:underline"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Kevesebb' : 'Több'}
        </button>
      )}

      <div className="flex gap-2 mt-3">
        <button
          className="bg-primary text-white px-3 py-1.5 rounded-md text-sm hover:bg-primary-hover disabled:opacity-50"
          disabled={busy}
          onClick={async () => { setBusy(true); await onApprove(proposal.id); setBusy(false); }}
        >
          Jóváhagy
        </button>
        <button
          className="px-3 py-1.5 rounded-md text-sm text-ink-2 hover:bg-cream disabled:opacity-50"
          disabled={busy}
          onClick={async () => { setBusy(true); await onReject(proposal.id); setBusy(false); }}
        >
          Elutasít
        </button>
      </div>
    </div>
  );
}
