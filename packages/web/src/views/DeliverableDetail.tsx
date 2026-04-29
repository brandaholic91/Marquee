import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { deliverablesApi, type DeliverableRow } from '../lib/api.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { TypeBadge } from '../components/TypeBadge.js';
import { RevisionTabs } from '../components/RevisionTabs.js';
import { DeliverableActions } from '../components/DeliverableActions.js';

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

  if (!data) return <div className="text-ink-2">Betöltés…</div>;

  const { deliverable, revisions } = data;
  const current = revisions.find((r) => r.id === selectedRev) ?? revisions[revisions.length - 1];

  return (
    <div>
      <header className="flex items-center gap-3 mb-4">
        <h1 className="font-serif text-2xl">
          Deliverable {deliverable.id.slice(0, 12)}…
        </h1>
        <TypeBadge type={deliverable.type} />
        <StatusBadge status={deliverable.status} />
      </header>

      <RevisionTabs
        revisions={revisions}
        currentId={deliverable.currentRevisionId ?? undefined}
        selectedId={selectedRev}
        onSelect={setSelectedRev}
      />

      <div className="border border-rule bg-off-white rounded-lg p-6 mt-3">
        {current ? (
          <div className="text-ink-2 italic">
            Verzió {current.revisionNo} fájl:{' '}
            <code className="font-mono">{current.artifactPath ?? '—'}</code>
          </div>
        ) : (
          <div className="text-ink-2 italic">Még nincs revízió.</div>
        )}
      </div>

      {deliverable.status === 'awaiting_approval' && (
        <DeliverableActions deliverableId={deliverable.id} />
      )}
    </div>
  );
}
