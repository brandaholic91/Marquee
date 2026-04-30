import { useState, useEffect } from 'react';
import { reviewsApi, type ReviewRow, type ReviewComment } from '../lib/api.js';

const SCORE_CONFIG: { max: number; label: string; cls: string }[] = [
  { max: 3,  label: 'Jelentős eltérés',   cls: 'bg-red-100 text-red-700' },
  { max: 6,  label: 'Részleges eltérés',  cls: 'bg-yellow-100 text-yellow-700' },
  { max: 8,  label: 'Kisebb finomítások', cls: 'bg-green-100 text-green-700' },
  { max: 10, label: 'Brand voice OK',     cls: 'bg-success-soft text-success-deep' },
];

function scoreBadge(score: number) {
  const cfg = SCORE_CONFIG.find((c) => score <= c.max) ?? SCORE_CONFIG[SCORE_CONFIG.length - 1];
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${cfg.cls}`}>
      {score}/10 — {cfg.label}
    </span>
  );
}

function severityIcon(severity: ReviewComment['severity']) {
  return severity === 'error' ? '🔴' : severity === 'warn' ? '🟡' : 'ℹ️';
}

export function BrandVoiceReviewPanel({ deliverableId }: { deliverableId: string }) {
  const [reviews, setReviews] = useState<ReviewRow[] | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [triggering, setTriggering] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadReviews = () =>
    reviewsApi.list(deliverableId).then((rows) => {
      setReviews(rows);
      setSelectedIdx(0);
    });

  useEffect(() => { void loadReviews(); }, [deliverableId]);

  const handleTrigger = async () => {
    setTriggering(true);
    await reviewsApi.trigger(deliverableId);
    let attempts = 0;
    const prevCount = reviews?.length ?? 0;
    const poll = setInterval(async () => {
      const rows = await reviewsApi.list(deliverableId);
      if (rows.length > prevCount || attempts > 20) {
        setReviews(rows);
        setSelectedIdx(0);
        setTriggering(false);
        clearInterval(poll);
      }
      attempts++;
    }, 2000);
  };

  const current = reviews?.[selectedIdx] ?? null;

  return (
    <div className="mt-6 border border-rule rounded-lg bg-off-white p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-ink-1">Brand Voice ellenőrzés</span>
        {reviews && reviews.length > 1 && (
          <select
            className="text-xs border border-rule rounded px-2 py-1 bg-parchment text-ink-2"
            value={selectedIdx}
            onChange={(e) => setSelectedIdx(Number(e.target.value))}
          >
            {reviews.map((r, i) => (
              <option key={r.id} value={i}>
                {new Date(r.createdAt).toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' })}
              </option>
            ))}
          </select>
        )}
      </div>

      {triggering ? (
        <div className="text-ink-2 text-sm italic">Guardian fut… (max ~30 mp)</div>
      ) : !current ? (
        <div>
          <p className="text-sm text-ink-2 mb-3">Még nem fut brand voice ellenőrzés erre a deliverable-re.</p>
          <button
            className="px-4 py-2 rounded-md text-sm bg-primary text-white hover:bg-primary-hover"
            onClick={handleTrigger}
          >
            Brand Voice ellenőrzés indítása
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3 mb-2">
            {scoreBadge(current.score)}
            <span className="text-sm text-ink-2">{current.summary}</span>
          </div>

          <button
            className="text-xs text-primary-hover hover:underline mb-2"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? '▲ Részletek elrejtése' : '▼ Részletek megtekintése'}
          </button>

          {expanded && (
            <div className="space-y-4">
              {current.comments.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-ink-2 uppercase tracking-wide mb-2">Észrevételek</p>
                  {current.comments.map((c, i) => (
                    <div key={i} className="mb-2 bg-cream border border-rule rounded p-3 text-sm">
                      <span className="mr-1">{severityIcon(c.severity)}</span>
                      <span className="italic text-ink-2">„{c.quote}"</span>
                      <span className="ml-2 text-ink-1">— {c.issue}</span>
                    </div>
                  ))}
                </div>
              )}

              {current.suggestions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-ink-2 uppercase tracking-wide mb-2">Javaslatok</p>
                  {current.suggestions.map((s, i) => (
                    <div key={i} className="mb-2 bg-cream border border-rule rounded p-3 text-sm">
                      <div className="text-ink-2 italic line-through mb-1">„{s.original}"</div>
                      <div className="text-ink-1 mb-1">→ „{s.suggested}"</div>
                      <div className="text-xs text-ink-2">{s.reasoning}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-3">
            <button
              className="text-xs text-ink-2 hover:underline"
              onClick={handleTrigger}
            >
              Újra ellenőrzés
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
