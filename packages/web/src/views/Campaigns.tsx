import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { campaignsApi, type CampaignRow, type CampaignDetail } from '../lib/api.js';

const STATUS_LABEL: Record<string, string> = {
  active: 'Aktív',
  completed: 'Befejezett',
  archived: 'Archivált',
};

const STATUS_CLASS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  archived: 'bg-gray-100 text-gray-500',
};

const TYPE_LABEL: Record<string, string> = {
  social_post: 'Social poszt',
  email: 'Email',
  blog_post: 'Blog poszt',
  ad_copy: 'Hirdetés',
};

const DELIVERABLE_STATUS_LABEL: Record<string, string> = {
  drafting: 'Folyamatban',
  awaiting_approval: 'Jóváhagyásra vár',
  shipped: 'Kiszállítva',
  archived: 'Archivált',
};

export function Campaigns() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [selected, setSelected] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    campaignsApi.list()
      .then((rows) => {
        setCampaigns(Array.isArray(rows) ? rows : []);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(String(err));
        setLoading(false);
      });
  }, []);

  async function selectCampaign(id: string) {
    const detail = await campaignsApi.get(id);
    setSelected(detail);
  }

  async function setStatus(id: string, status: string) {
    await campaignsApi.patch(id, { status });
    setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, status: status as CampaignRow['status'] } : c));
    if (selected?.id === id) setSelected((prev) => prev ? { ...prev, status: status as CampaignRow['status'] } : prev);
  }

  if (loading) return <p className="text-ink-2 text-sm py-8">Betöltés…</p>;
  if (error) return <p className="text-red-600 text-sm py-8">Hiba: {error}</p>;

  if (campaigns.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-ink-2">Még nincs kampány.</p>
        <p className="text-ink-2 text-sm mt-1">A Director automatikusan létrehoz egyet, ha kampánynevet adsz egy brief javaslatakor.</p>
      </div>
    );
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-130px)]">
      {/* Campaign list */}
      <div className="w-72 shrink-0 overflow-y-auto space-y-2">
        {campaigns.map((c) => (
          <button
            key={c.id}
            onClick={() => void selectCampaign(c.id)}
            className={`w-full text-left rounded-lg border-l-[3px] p-4 transition-colors ${
              selected?.id === c.id
                ? 'border-primary border-l-primary bg-primary-soft'
                : 'border-rule border-l-transparent bg-off-white hover:bg-parchment'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-sm text-ink-1 leading-snug">{c.title}</span>
              <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASS[c.status] ?? ''}`}>
                {STATUS_LABEL[c.status] ?? c.status}
              </span>
            </div>
            <div className="mt-2 flex gap-3 text-xs text-ink-2">
              <span>{c.deliverableCount} tartalom</span>
              {c.pendingApprovals > 0 && (
                <span className="text-amber-700 font-medium">{c.pendingApprovals} vár</span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Campaign detail */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[18px] font-bold text-ink-1 tracking-tight">{selected.title}</h2>
                <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASS[selected.status] ?? ''}`}>
                  {STATUS_LABEL[selected.status] ?? selected.status}
                </span>
              </div>
              <div className="flex gap-2">
                {selected.status !== 'completed' && (
                  <button
                    onClick={() => void setStatus(selected.id, 'completed')}
                    className="text-xs px-3 py-1.5 rounded border border-rule text-ink-2 hover:bg-cream"
                  >
                    Befejezett
                  </button>
                )}
                {selected.status !== 'archived' && (
                  <button
                    onClick={() => void setStatus(selected.id, 'archived')}
                    className="text-xs px-3 py-1.5 rounded border border-rule text-ink-2 hover:bg-cream"
                  >
                    Archiválás
                  </button>
                )}
                {selected.status === 'archived' && (
                  <button
                    onClick={() => void setStatus(selected.id, 'active')}
                    className="text-xs px-3 py-1.5 rounded border border-rule text-ink-2 hover:bg-cream"
                  >
                    Visszaállítás
                  </button>
                )}
              </div>
            </div>

            {selected.deliverables.length === 0 ? (
              <p className="text-ink-2 text-sm">Még nincs tartalom ebben a kampányban.</p>
            ) : (
              <div className="space-y-2">
                {selected.deliverables.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => navigate(`/jovahagyas/${d.id}`)}
                    className="w-full text-left border border-rule rounded-[8px] px-3.5 py-3 bg-off-white hover:border-rule-strong hover:bg-parchment flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="bg-parchment text-ink-2 text-[10px] font-semibold px-2 py-0.5 rounded-chip">
                        {TYPE_LABEL[d.type] ?? d.type}
                      </span>
                      <span className="text-[13px] text-ink-1">
                        {new Date(d.updatedAt).toLocaleDateString('hu-HU')}
                      </span>
                    </div>
                    <span className="text-[11px] text-ink-2">{DELIVERABLE_STATUS_LABEL[d.status] ?? d.status}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-ink-2 text-sm pt-4">Válassz ki egy kampányt a részletek megtekintéséhez.</p>
        )}
      </div>
    </div>
  );
}
