import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  campaignsApi,
  plansApi,
  type CampaignRow,
  type CampaignDetail,
  type CampaignPlan,
  type CalendarItem,
} from "../lib/api.js";
import { PlanEditor } from "../components/PlanEditor.js";
import { CalendarItemCard } from "../components/CalendarItemCard.js";
import { CalendarItemEditModal } from "../components/CalendarItemEditModal.js";
import { marqueeEvents } from "../lib/sse.js";
import { useMarqueeStore } from "../store/useMarqueeStore.js";

const STATUS_LABEL: Record<string, string> = {
  active: "Aktív",
  completed: "Befejezett",
  archived: "Archivált",
};

const STATUS_CLASS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  completed: "bg-blue-100 text-blue-800",
  archived: "bg-gray-100 text-gray-500",
};

const TYPE_LABEL: Record<string, string> = {
  social_post: "Social poszt",
  email: "Email",
  blog_post: "Blog poszt",
  ad_copy: "Hirdetés",
};

const DELIVERABLE_STATUS_LABEL: Record<string, string> = {
  drafting: "Folyamatban",
  awaiting_approval: "Jóváhagyásra vár",
  shipped: "Kiszállítva",
  archived: "Archivált",
};

type ExpandedData = {
  detail: CampaignDetail;
  plan: CampaignPlan | null;
  items: CalendarItem[];
};

export function Campaigns() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<ExpandedData | null>(null);
  const [expandLoading, setExpandLoading] = useState(false);
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<CalendarItem | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const createThread = useMarqueeStore((s) => s.createThread);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    campaignsApi
      .list()
      .then((rows) => {
        setCampaigns(Array.isArray(rows) ? rows : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!expandedId) {
      setExpandedData(null);
      return;
    }
    setExpandLoading(true);
    void Promise.all([campaignsApi.get(expandedId), plansApi.get(expandedId)])
      .then(([detail, planRes]) => {
        setExpandedData({ detail, plan: planRes.plan, items: planRes.calendar_items });
      })
      .finally(() => setExpandLoading(false));
  }, [expandedId]);

  useEffect(() => {
    if (!expandedId) return;
    marqueeEvents.start();
    const refresh = () =>
      void plansApi.get(expandedId).then((r) =>
        setExpandedData((d) => (d ? { ...d, plan: r.plan, items: r.calendar_items } : null))
      );
    const unsubs = [
      marqueeEvents.on("plan.accepted", refresh),
      marqueeEvents.on("plan.updated", refresh),
      marqueeEvents.on("calendar_item.added", refresh),
      marqueeEvents.on("calendar_item.updated", refresh),
      marqueeEvents.on("calendar_item.status_changed", refresh),
    ];
    return () => unsubs.forEach((u) => u());
  }, [expandedId]);

  async function handleCreate() {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    setCreateError(null);
    try {
      await campaignsApi.create(title);
      await createThread();
      setShowModal(false);
      navigate('/', { state: { prefilledMessage: `Tervezzük meg a ${title} kampányt` } });
    } catch (err: unknown) {
      const body = err as { error?: string };
      if (body?.error === 'campaign_exists') {
        setCreateError('Ez a kampánynév már foglalt.');
      } else {
        setCreateError('Hiba történt. Próbáld újra.');
      }
      setCreating(false);
    }
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  async function setStatus(id: string, status: string) {
    await campaignsApi.patch(id, { status });
    setCampaigns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: status as CampaignRow["status"] } : c))
    );
    if (expandedData?.detail.id === id) {
      setExpandedData((d) =>
        d ? { ...d, detail: { ...d.detail, status: status as CampaignDetail["status"] } } : null
      );
    }
  }

  const keyMessageById = new Map(
    (expandedData?.plan?.keyMessages ?? []).map((km) => [km.id, km.text])
  );

  if (loading) return <p className="text-ink-2 text-sm py-8 px-5">Betöltés…</p>;


  return (
    <div className="flex-1 overflow-auto p-5 pb-14 md:pb-5 space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-ink-1">Kampányok</h1>
        <button
          className="text-xs px-3 py-1.5 rounded border border-rule text-ink-2 hover:bg-parchment"
          onClick={() => { setNewTitle(''); setCreateError(null); setShowModal(true); }}
        >
          + Új kampány
        </button>
      </div>

      {campaigns.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-ink-2">Még nincs kampány.</p>
          <p className="text-ink-2 text-sm mt-1">Kattints az „+ Új kampány" gombra a kezdéshez.</p>
        </div>
      )}

      {campaigns.map((c) => {
        const isExpanded = expandedId === c.id;
        const progress = c.plan_summary?.calendar_progress;

        return (
          <div key={c.id} className="border border-rule rounded-lg overflow-hidden">
            <button
              className="w-full text-left px-4 py-3 flex items-center justify-between bg-off-white hover:bg-parchment transition-colors"
              onClick={() => void toggleExpand(c.id)}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-ink-1 truncate">{c.title}</span>
                  <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_CLASS[c.status] ?? ""}`}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
                </div>
                <div className="text-[11px] text-ink-3 mt-0.5">
                  {c.deliverableCount} tartalom
                  {c.pendingApprovals > 0 ? ` · ${c.pendingApprovals} vár` : ""}
                  {progress
                    ? ` · 📋 ${progress.planned + progress.brief_created} tervezett, ${progress.delivered} kész`
                    : ""}
                </div>
              </div>
              <span className="text-ink-3 text-sm ml-3 shrink-0">{isExpanded ? "▾" : "▸"}</span>
            </button>

            {isExpanded && (
              <div className="border-t border-rule bg-cream px-4 py-4 space-y-6">
                {expandLoading ? (
                  <p className="text-ink-2 text-sm">Betöltés…</p>
                ) : (
                  <>
                    <div className="flex gap-2 flex-wrap">
                      {c.status !== "completed" && (
                        <button
                          onClick={() => void setStatus(c.id, "completed")}
                          className="text-xs px-3 py-1.5 rounded border border-rule text-ink-2 hover:bg-parchment"
                        >
                          Befejezett
                        </button>
                      )}
                      {c.status !== "archived" && (
                        <button
                          onClick={() => void setStatus(c.id, "archived")}
                          className="text-xs px-3 py-1.5 rounded border border-rule text-ink-2 hover:bg-parchment"
                        >
                          Archiválás
                        </button>
                      )}
                      {c.status === "archived" && (
                        <button
                          onClick={() => void setStatus(c.id, "active")}
                          className="text-xs px-3 py-1.5 rounded border border-rule text-ink-2 hover:bg-parchment"
                        >
                          Visszaállítás
                        </button>
                      )}
                    </div>

                    <div>
                      <h2 className="text-sm font-semibold text-ink-1 mb-3">Kampányterv</h2>
                      <PlanEditor
                        initial={expandedData?.plan ?? null}
                        busy={saving}
                        onStartPlanning={() => navigate("/")}
                        onCreateEmptyPlan={async () => {
                          setSaving(true);
                          try {
                            await plansApi.put(c.id, {
                              goal: "",
                              goal_type: "other",
                              audience: "",
                              key_messages: [],
                              channel_mix: [],
                              timeline_start: null,
                              timeline_end: null,
                              kpi: "",
                            });
                            const r = await plansApi.get(c.id);
                            setExpandedData((d) => (d ? { ...d, plan: r.plan, items: r.calendar_items } : null));
                          } finally {
                            setSaving(false);
                          }
                        }}
                        onSave={async (form) => {
                          setSaving(true);
                          try {
                            await plansApi.put(c.id, form);
                            const r = await plansApi.get(c.id);
                            setExpandedData((d) => (d ? { ...d, plan: r.plan } : null));
                          } finally {
                            setSaving(false);
                          }
                        }}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold text-ink-1">Calendar</h2>
                        <button
                          className="text-xs px-3 py-1.5 rounded border border-rule text-ink-2 hover:bg-parchment"
                          onClick={() => setAddingItem(true)}
                        >
                          Item hozzáadása
                        </button>
                      </div>
                      {(expandedData?.items ?? []).length === 0 ? (
                        <p className="text-sm text-ink-2">Még nincs calendar item.</p>
                      ) : (
                        <div className="space-y-2">
                          {(expandedData?.items ?? []).map((item) => (
                            <CalendarItemCard
                              key={item.id}
                              item={item}
                              keyMessageText={
                                item.keyMessageRef ? keyMessageById.get(item.keyMessageRef) ?? null : null
                              }
                              onEdit={(current) => setEditingItem(current)}
                              onDelete={(itemId) =>
                                void plansApi
                                  .deleteCalendarItem(c.id, itemId)
                                  .then(() => plansApi.get(c.id))
                                  .then((r) =>
                                    setExpandedData((d) =>
                                      d ? { ...d, items: r.calendar_items } : null
                                    )
                                  )
                              }
                              onOpenApprovals={() => navigate("/jovahagyas")}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {(expandedData?.detail.deliverables ?? []).length > 0 && (
                      <div>
                        <h2 className="text-sm font-semibold text-ink-1 mb-3">Tartalmak</h2>
                        <div className="space-y-2">
                          {expandedData?.detail.deliverables.map((d) => (
                            <button
                              key={d.id}
                              onClick={() => navigate(`/jovahagyas/${d.id}`)}
                              className="w-full text-left border border-rule rounded-[8px] px-3.5 py-3 bg-off-white hover:border-rule-strong hover:bg-parchment flex items-center justify-between transition-colors"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="bg-parchment text-ink-2 text-[10px] font-semibold px-2 py-0.5 rounded-chip">
                                  {TYPE_LABEL[d.type] ?? d.type}
                                </span>
                                <span className="text-[13px] text-ink-1">
                                  {d.title ?? new Date(d.updatedAt).toLocaleDateString("hu-HU")}
                                </span>
                              </div>
                              <span className="text-[11px] text-ink-2">
                                {DELIVERABLE_STATUS_LABEL[d.status] ?? d.status}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-cream border border-rule rounded-lg p-6 w-full max-w-sm shadow-lg">
            <h2 className="text-sm font-semibold text-ink-1 mb-4">Új kampány</h2>
            <label className="block text-xs text-ink-2 mb-1">Kampány neve</label>
            <input
              autoFocus
              className="w-full border border-rule rounded px-3 py-2 text-sm text-ink-1 bg-off-white mb-1 focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="pl. GrowthFrame Q3 brand"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreate();
                if (e.key === 'Escape') setShowModal(false);
              }}
            />
            {createError && <p className="text-xs text-red-500 mb-2">{createError}</p>}
            <div className="flex gap-2 justify-end mt-4">
              <button
                className="text-xs px-3 py-1.5 rounded border border-rule text-ink-2 hover:bg-parchment"
                onClick={() => setShowModal(false)}
              >
                Mégsem
              </button>
              <button
                disabled={creating || !newTitle.trim()}
                className="text-xs px-4 py-1.5 rounded bg-primary text-sidebar-bg font-semibold disabled:opacity-50"
                onClick={() => void handleCreate()}
              >
                {creating ? 'Létrehozás…' : 'Létrehozás'}
              </button>
            </div>
          </div>
        </div>
      )}

      {(addingItem || editingItem) && (
        <CalendarItemEditModal
          initial={editingItem}
          keyMessages={expandedData?.plan?.keyMessages ?? []}
          onClose={() => {
            setAddingItem(false);
            setEditingItem(null);
          }}
          onSave={async (payload) => {
            if (!expandedId) return;
            if (editingItem) {
              await plansApi.updateCalendarItem(expandedId, editingItem.id, payload);
            } else {
              await plansApi.createCalendarItem(expandedId, payload);
            }
            setAddingItem(false);
            setEditingItem(null);
            const r = await plansApi.get(expandedId);
            setExpandedData((d) => (d ? { ...d, items: r.calendar_items } : null));
          }}
        />
      )}
    </div>
  );
}
