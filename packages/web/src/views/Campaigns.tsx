import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { campaignsApi, type CampaignRow, type CampaignDetail } from '../lib/api.js';
import { SidebarPanel, SidebarPanelHeader, SidebarPanelBody, SidebarPanelItem } from '../components/SidebarPanel.js';

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

  if (loading) return <p className="text-ink-2 text-sm py-8 px-5">Betöltés…</p>;
  if (error) return <p className="text-red-600 text-sm py-8 px-5">Hiba: {error}</p>;

  if (campaigns.length === 0) {
    return (
      <div className="py-16 text-center px-5">
        <p className="text-ink-2">Még nincs kampány.</p>
        <p className="text-ink-2 text-sm mt-1">A Director automatikusan létrehoz egyet, ha kampánynevet adsz egy brief javaslatakor.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 h-screen overflow-hidden">

      {/* Kampánylista */}
      <SidebarPanel visible={!selected}>
        <SidebarPanelHeader title="Kampányok" subtitle={`${campaigns.length} kampány`} />
        <SidebarPanelBody>
          {campaigns.map((c) => (
            <SidebarPanelItem
              key={c.id}
              isActive={selected?.id === c.id}
              onClick={() => void selectCampaign(c.id)}
            >
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-sm font-medium truncate">{c.title}</span>
                <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_CLASS[c.status] ?? ''}`}>
                  {STATUS_LABEL[c.status] ?? c.status}
                </span>
              </div>
              <div className="mt-0.5 text-[11px] text-ink-3">
                {c.deliverableCount} tartalom{c.pendingApprovals > 0 ? ` · ${c.pendingApprovals} vár` : ''}
              </div>
            </SidebarPanelItem>
          ))}
        </SidebarPanelBody>
      </SidebarPanel>

      {/* Kampány részletek */}
      <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0 overflow-hidden`}>
        {selected ? (
          <>
            <div className="px-5 py-4 border-b border-rule flex items-start justify-between gap-3 bg-cream shrink-0">
              <div className="flex items-start gap-2 min-w-0">
                <button
                  onClick={() => setSelected(null)}
                  className="md:hidden shrink-0 text-ink-2 text-[13px] font-medium mt-0.5"
                >
                  ← Vissza
                </button>
                <div>
                  <h2 className="text-[15px] font-bold text-ink-1 tracking-tight">{selected.title}</h2>
                  <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASS[selected.status] ?? ''}`}>
                    {STATUS_LABEL[selected.status] ?? selected.status}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => navigate(`/kampanyok/${selected.id}`)}
                  className="text-xs px-3 py-1.5 rounded border border-rule text-ink-2 hover:bg-parchment"
                >
                  Terv nézet
                </button>
                {selected.status !== 'completed' && (
                  <button
                    onClick={() => void setStatus(selected.id, 'completed')}
                    className="text-xs px-3 py-1.5 rounded border border-rule text-ink-2 hover:bg-parchment"
                  >
                    Befejezett
                  </button>
                )}
                {selected.status !== 'archived' && (
                  <button
                    onClick={() => void setStatus(selected.id, 'archived')}
                    className="text-xs px-3 py-1.5 rounded border border-rule text-ink-2 hover:bg-parchment"
                  >
                    Archiválás
                  </button>
                )}
                {selected.status === 'archived' && (
                  <button
                    onClick={() => void setStatus(selected.id, 'active')}
                    className="text-xs px-3 py-1.5 rounded border border-rule text-ink-2 hover:bg-parchment"
                  >
                    Visszaállítás
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto p-5 pb-14 md:pb-5">
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
                          {d.title ?? new Date(d.updatedAt).toLocaleDateString('hu-HU')}
                        </span>
                      </div>
                      <span className="text-[11px] text-ink-2">{DELIVERABLE_STATUS_LABEL[d.status] ?? d.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-ink-2 text-sm">Válassz ki egy kampányt a részletek megtekintéséhez.</p>
          </div>
        )}
      </div>
    </div>
  );
}
