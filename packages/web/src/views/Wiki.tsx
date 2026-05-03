import { useEffect, useState } from 'react';
import { MarkdownView } from '../components/MarkdownView.js';
import { SidebarPanel, SidebarPanelHeader, SidebarPanelBody } from '../components/SidebarPanel.js';

const WIKI_PAGES = ['brand-voice-patterns.md', 'seo-learnings.md', 'content-performance.md', 'SCHEMA.md'];

interface WikiProposal {
  id: string;
  wikiPage: string;
  newContent: string;
  reason: string | null;
  createdAt: number;
}

export function Wiki() {
  const [selectedPage, setSelectedPage] = useState<string>(WIKI_PAGES[0]);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState<WikiProposal[]>([]);
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  const loadPage = async (page: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/wiki/${encodeURIComponent(page)}`);
      if (res.ok) {
        const data = await res.json();
        setContent(data.content || '');
      } else {
        setContent('');
      }
    } catch (err) {
      console.error('Failed to load wiki page:', err);
      setContent('');
    } finally {
      setLoading(false);
    }
  };

  const loadProposals = async () => {
    try {
      const res = await fetch('/api/wiki/proposals');
      if (res.ok) {
        const data = await res.json();
        setProposals(data.proposals || []);
      }
    } catch (err) {
      console.error('Failed to load wiki proposals:', err);
    }
  };

  useEffect(() => {
    void loadPage(selectedPage);
    void loadProposals();
  }, [selectedPage]);

  const handleApproveProposal = async (id: string) => {
    try {
      const res = await fetch(`/api/wiki/proposals/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        await loadProposals();
        await loadPage(selectedPage);
      }
    } catch (err) {
      console.error('Failed to approve proposal:', err);
    }
  };

  const handleRejectProposal = async (id: string) => {
    try {
      const res = await fetch(`/api/wiki/proposals/${id}/reject`, { method: 'POST' });
      if (res.ok) {
        await loadProposals();
      }
    } catch (err) {
      console.error('Failed to reject proposal:', err);
    }
  };

  const pendingProposals = proposals.filter(p => !p.createdAt || true); // Show all proposals for now

  return (
    <div className="flex flex-1 h-screen overflow-hidden">
      {/* Sidebar */}
      <SidebarPanel visible={mobileView !== 'detail'}>
        <SidebarPanelHeader
          title="Wiki"
          subtitle={`${WIKI_PAGES.length} lap${pendingProposals.length > 0 ? ` · ${pendingProposals.length} javaslat` : ''}`}
        />
        {pendingProposals.length > 0 && (
          <div className="mx-3 mt-3">
            <button className="w-full flex items-center gap-2 bg-primary-soft border border-primary rounded-[6px] px-2.5 py-1.5 text-[11px] font-semibold text-primary-deep">
              <span className="bulb" />
              {pendingProposals.length} függő javaslat
            </button>
          </div>
        )}
        <SidebarPanelBody>
          <div className="flex flex-col gap-1">
            {WIKI_PAGES.map((page) => (
              <button
                key={page}
                onClick={() => {
                  setSelectedPage(page);
                  setMobileView('detail');
                }}
                className={`px-3 py-2 rounded text-left text-[13px] font-medium transition ${
                  selectedPage === page
                    ? 'bg-sidebar-active text-primary'
                    : 'text-sidebar-text hover:bg-sidebar-active'
                }`}
              >
                {page.replace('.md', '')}
              </button>
            ))}
          </div>
        </SidebarPanelBody>
      </SidebarPanel>

      {/* Main content */}
      <div className={`${mobileView === 'detail' ? 'flex' : 'hidden md:flex'} flex-1 flex flex-col min-w-0 overflow-hidden`}>
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-rule bg-cream flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileView('list')}
              className="md:hidden text-ink-2 text-[13px] font-medium shrink-0"
            >
              ← Vissza
            </button>
            <span className="font-mono text-[14px] font-bold text-ink-1">{selectedPage}</span>
          </div>
        </div>

        {/* Pending proposals */}
        {pendingProposals.length > 0 && (
          <div className="px-5 py-4 border-b border-rule">
            <p className="text-[11px] font-semibold text-ink-2 mb-3">Függő javaslatok ({pendingProposals.length})</p>
            <div className="flex flex-col gap-3">
              {pendingProposals.map((proposal) => (
                <WikiProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  onApprove={handleApproveProposal}
                  onReject={handleRejectProposal}
                />
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-5 pb-14 md:pb-5">
          {loading ? (
            <p className="text-ink-3 text-[13px]">Betöltés…</p>
          ) : (
            <div className="bg-off-white border border-rule rounded-card p-5 max-w-2xl">
              <MarkdownView content={content} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface WikiProposalCardProps {
  proposal: WikiProposal;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

function WikiProposalCard({ proposal, onApprove, onReject }: WikiProposalCardProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const handleApproveClick = async () => {
    setIsApproving(true);
    try {
      await onApprove(proposal.id);
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectClick = async () => {
    setIsRejecting(true);
    try {
      await onReject(proposal.id);
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="bg-parchment rounded-[6px] p-3 border border-rule text-[12px] space-y-2">
      <div>
        <p className="font-semibold text-ink-1">{proposal.wikiPage}</p>
        {proposal.reason && <p className="text-ink-3 mt-1">{proposal.reason}</p>}
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleApproveClick}
          disabled={isApproving || isRejecting}
          className="flex-1 bg-primary text-sidebar-bg font-bold py-1.5 rounded-btn text-[11px] disabled:opacity-50"
        >
          {isApproving ? 'Jóváhagyás…' : 'Jóváhagy'}
        </button>
        <button
          onClick={handleRejectClick}
          disabled={isApproving || isRejecting}
          className="flex-1 bg-off-white border border-rule text-ink-2 font-medium py-1.5 rounded-btn text-[11px] disabled:opacity-50"
        >
          {isRejecting ? 'Elutasítás…' : 'Elutasít'}
        </button>
      </div>
    </div>
  );
}
