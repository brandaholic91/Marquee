import { useState, useEffect } from 'react';

interface WikiProposal {
  id: string;
  page: string;
  reason: string | null;
  newContent: string;
  createdAt: number;
}

interface WikiProposalsQueueProps {
  onApprove?: () => void;
}

export default function WikiProposalsQueue({ onApprove }: WikiProposalsQueueProps) {
  const [proposals, setProposals] = useState<WikiProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadProposals();
  }, []);

  const loadProposals = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wiki/proposals');
      if (res.ok) {
        const data = await res.json();
        setProposals(data.proposals || []);
      }
    } catch (err) {
      console.error('Javaslatokat nem sikerült betölteni:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/wiki/proposals/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        setProposals(proposals.filter((p) => p.id !== id));
        onApprove?.();
      }
    } catch (err) {
      console.error('Jóváhagyás sikertelen:', err);
    }
  };

  const handleReject = async (id: string) => {
    try {
      const res = await fetch(`/api/wiki/proposals/${id}/reject`, { method: 'POST' });
      if (res.ok) {
        setProposals(proposals.filter((p) => p.id !== id));
      }
    } catch (err) {
      console.error('Elutasítás sikertelen:', err);
    }
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
  };

  if (loading) {
    return <p className="text-xs text-ink-2">Javaslatokat betöltjük...</p>;
  }

  if (proposals.length === 0) {
    return <p className="text-xs text-ink-2">Nincsenek függőben lévő javaslatok</p>;
  }

  return (
    <div className="space-y-3">
      {proposals.map((proposal) => {
        const isExpanded = expanded.has(proposal.id);
        const preview = proposal.newContent.slice(0, 150);
        return (
          <div key={proposal.id} className="border-[1.5px] border-primary rounded-lg p-4 bg-off-white">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-ink-1">Wiki javaslat: <code className="font-mono text-sm">{proposal.page}</code></h4>
                {proposal.reason && <p className="text-xs text-ink-2 mt-1">{proposal.reason}</p>}
              </div>
              <span className="text-xs text-ink-2">{new Date(proposal.createdAt).toLocaleString('hu-HU')}</span>
            </div>

            <pre className={`mt-3 p-3 bg-parchment rounded-md text-xs whitespace-pre-wrap font-mono ${isExpanded ? '' : 'max-h-24 overflow-hidden'}`}>
              {isExpanded ? proposal.newContent : preview + (proposal.newContent.length > 150 ? '…' : '')}
            </pre>
            {proposal.newContent.length > 150 && (
              <button
                className="mt-1 text-xs text-primary hover:underline"
                onClick={() => toggleExpanded(proposal.id)}
              >
                {isExpanded ? 'Kevesebb' : 'Több'}
              </button>
            )}

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleApprove(proposal.id)}
                className="bg-primary text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary-hover"
              >
                Jóváhagy
              </button>
              <button
                onClick={() => handleReject(proposal.id)}
                className="px-3 py-1.5 rounded-md text-sm text-ink-2 hover:bg-cream font-medium"
              >
                Elutasít
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
