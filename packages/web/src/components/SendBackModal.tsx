import { useState, useEffect } from 'react';
import { reviewsApi, type ReviewRow } from '../lib/api.js';

interface SendBackModalProps {
  deliverableId: string;
  onCancel: () => void;
  onSubmit: (note: string) => Promise<void> | void;
}

export function SendBackModal({ deliverableId, onCancel, onSubmit }: SendBackModalProps) {
  const [note, setNote] = useState('');
  const [latestReview, setLatestReview] = useState<ReviewRow | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    reviewsApi.list(deliverableId).then((rows) => setLatestReview(rows[0] ?? null));
  }, [deliverableId]);

  const hasReview = !!latestReview;
  const loading = latestReview === undefined;

  return (
    <div
      className="fixed inset-0 bg-ink-1/40 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-off-white rounded-lg p-6 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-lg mb-3">Visszaküldés javításra</h3>

        {!loading && hasReview && (
          <div className="mb-4 bg-primary-soft border border-primary/20 rounded-md px-4 py-3 text-sm text-primary-hover">
            <span className="font-medium">Brand voice ellenőrzés csatolva.</span>{' '}
            Az anyag a Guardian visszajelzésével együtt kerül vissza a specialistához.
            Csak akkor írj az alábbi mezőbe, ha van pluszban mondanivalód.
          </div>
        )}

        <textarea
          autoFocus
          className="w-full border border-rule-strong rounded-md p-3 min-h-[120px] font-sans"
          placeholder={
            hasReview
              ? 'Opcionális: plusz megjegyzés a brand voice ellenőrzésen felül…'
              : 'Pl. túl rövid, hiányzik a CTA, nem elég erős a hook…'
          }
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="flex justify-end gap-2 mt-4">
          <button
            className="px-3 py-2 rounded-md text-ink-2 hover:bg-cream"
            onClick={onCancel}
          >
            Mégsem
          </button>
          <button
            className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-hover disabled:opacity-50"
            disabled={busy || loading || (!hasReview && !note.trim())}
            onClick={async () => {
              setBusy(true);
              await onSubmit(note);
              setBusy(false);
            }}
          >
            Visszaküld
          </button>
        </div>
      </div>
    </div>
  );
}
