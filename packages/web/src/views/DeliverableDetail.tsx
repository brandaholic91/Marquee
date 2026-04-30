import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { deliverablesApi, type DeliverableRow } from '../lib/api.js';
import { useMarqueeStore } from '../store/useMarqueeStore.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { TypeBadge } from '../components/TypeBadge.js';
import { RevisionTabs } from '../components/RevisionTabs.js';
import { DeliverableActions } from '../components/DeliverableActions.js';
import { MarkdownView } from '../components/MarkdownView.js';
import { BrandVoiceReviewPanel } from '../components/BrandVoiceReviewPanel.js';

function DraftingActions({ deliverableId }: { deliverableId: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();
  const discard = useMarqueeStore((s) => s.discardDeliverable);

  return (
    <div className="flex items-center gap-3 mt-6">
      <button
        className="px-3 py-2 rounded-md text-ink-2 hover:bg-cream disabled:opacity-50 text-sm"
        disabled={busy || done}
        onClick={async () => {
          if (!confirm('Biztosan eldobod ezt a deliverable-t?')) return;
          setBusy(true);
          await discard(deliverableId);
          setDone(true);
          setTimeout(() => navigate('/jovahagyas'), 900);
        }}
      >
        {done ? 'Eldobva ✓' : 'Eldob'}
      </button>
    </div>
  );
}

interface Revision {
  id: string;
  revisionNo: number;
  artifactPath?: string;
}

interface DetailData {
  deliverable: DeliverableRow;
  revisions: Revision[];
}

export function DeliverableDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<DetailData | null>(null);
  const [selectedRev, setSelectedRev] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    if (!id) return;
    deliverablesApi.get(id).then((raw) => {
      // Cast revisions from unknown[] to Revision[]
      const d: DetailData = {
        deliverable: raw.deliverable,
        revisions: (raw.revisions as Revision[]) ?? [],
      };
      setData(d);
      setSelectedRev(d.deliverable.currentRevisionId ?? (d.revisions[d.revisions.length - 1]?.id ?? null));
    }).catch(() => setData(null));
  }, [id]);

  useEffect(() => {
    if (!id || !selectedRev) return;
    setLoadingContent(true);
    fetch(`/api/deliverables/${id}/revisions/${selectedRev}/content`)
      .then(r => r.json())
      .then((res: { content?: string; error?: string }) => {
        setContent(res.content ?? null);
        setLoadingContent(false);
      })
      .catch(() => {
        setContent(null);
        setLoadingContent(false);
      });
  }, [id, selectedRev]);

  if (!data) return <div className="text-ink-2">Betöltés…</div>;

  const { deliverable, revisions } = data;
  const current = revisions.find((r) => r.id === selectedRev) ?? revisions[revisions.length - 1];

  return (
    <div>
      <header className="flex items-center gap-3 mb-4">
        <TypeBadge type={deliverable.type} />
        <StatusBadge status={deliverable.status} />
        <span className="text-xs text-ink-2 ml-auto">
          {new Date(deliverable.createdAt).toLocaleDateString('hu-HU')}
        </span>
      </header>

      <RevisionTabs
        revisions={revisions}
        currentId={deliverable.currentRevisionId ?? undefined}
        selectedId={selectedRev}
        onSelect={setSelectedRev}
      />

      <div className="border border-rule bg-off-white rounded-lg p-6 mt-3">
        {current ? (
          <div>
            <div className="text-ink-2 text-sm mb-3 italic">
              Verzió {current.revisionNo}
            </div>
            {loadingContent ? (
              <div className="text-ink-2 italic">Betöltés…</div>
            ) : content ? (
              <MarkdownView content={content} />
            ) : (
              <div className="text-ink-2 italic">Nincs tartalom elérhető.</div>
            )}
          </div>
        ) : (
          <div className="text-ink-2 italic">Még nincs revízió.</div>
        )}
      </div>

      {deliverable.status === 'awaiting_approval' && (
        <DeliverableActions deliverableId={deliverable.id} />
      )}
      {deliverable.status === 'drafting' && (
        <DraftingActions deliverableId={deliverable.id} />
      )}
      <BrandVoiceReviewPanel deliverableId={deliverable.id} />
    </div>
  );
}
