import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarqueeStore } from '../store/useMarqueeStore.js';
import { dashboardApi, type DeliverableRow } from '../lib/api.js';
import { ChatThread } from '../components/ChatThread.js';
import { ChatComposer } from '../components/ChatComposer.js';

const AGENTS = [
  'director', 'copywriter', 'social-manager',
  'paid-specialist', 'email-marketer', 'seo-specialist',
];

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
}

function activityLabel(d: DeliverableRow) {
  if (d.status === 'shipped') return 'Kiszállítva';
  if (d.status === 'awaiting_approval') return 'Jóváhagyásra vár';
  if (d.status === 'drafting') return 'Folyamatban';
  return d.status;
}

export function HQ() {
  const navigate = useNavigate();
  const activeAgents = useMarqueeStore((s) => s.activeAgents);
  const pending = useMarqueeStore((s) => s.awaitingApprovalCount);
  const deliverables = useMarqueeStore((s) => s.deliverables);
  const fetchDeliverables = useMarqueeStore((s) => s.fetchDeliverables);
  const fetchInitialState = useMarqueeStore((s) => s.fetchInitialState);

  const [activity, setActivity] = useState<DeliverableRow[]>([]);

  useEffect(() => {
    void fetchInitialState();
    fetchDeliverables('awaiting_approval');
    dashboardApi.activity().then((rows) => {
      const sorted = [...rows].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10);
      setActivity(sorted);
    });
  }, [fetchDeliverables, fetchInitialState]);

  const today = new Date().toLocaleDateString('hu-HU', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  const activeList = AGENTS.filter((r) => activeAgents.has(r));
  const pendingList = deliverables.filter((d) => d.status === 'awaiting_approval').slice(0, 3);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* Topbar */}
      <div className="px-6 py-4 border-b border-rule flex items-center justify-between bg-cream shrink-0">
        <div>
          <h1 className="text-[22px] font-extrabold text-ink-1 tracking-tight">Headquarters</h1>
          <p className="text-[12px] text-ink-3 mt-0.5">{today}</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Bal panel — dashboard widgetek */}
        <div className="hidden md:flex w-[260px] shrink-0 border-r border-rule flex-col overflow-auto bg-parchment">
          <div className="p-4 flex flex-col gap-3">

            <p className="text-[10px] font-semibold text-ink-3 tracking-[0.08em] uppercase">Most</p>

            {/* Aktív agent */}
            <div className="bg-sidebar-bg rounded-card p-4 flex flex-col gap-2.5">
              <p className="text-[9px] font-semibold text-sidebar-muted tracking-[0.08em] uppercase">Aktív agent</p>
              {activeList.length === 0 ? (
                <p className="text-[12px] text-sidebar-muted">Jelenleg nincs aktív agent.</p>
              ) : (
                activeList.map((role) => (
                  <div key={role} className="flex items-center gap-2">
                    <span className="bulb" />
                    <span className="font-mono text-[13px] text-white font-medium">{role}</span>
                    <span className="ml-auto text-[11px] text-sidebar-muted">dolgozik…</span>
                  </div>
                ))
              )}
            </div>

            {/* Jóváhagyás alert */}
            {pending > 0 ? (
              <div className="bg-off-white border-[1.5px] border-primary rounded-card p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-semibold text-primary-deep tracking-[0.06em] uppercase">Jóváhagyásra vár</p>
                  <span className="bg-primary text-sidebar-bg text-[10px] font-extrabold rounded-chip w-[22px] h-[22px] flex items-center justify-center">
                    {pending}
                  </span>
                </div>
                {pendingList.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center bg-cream px-2 py-1.5 rounded-[6px] cursor-pointer hover:bg-parchment"
                    onClick={() => navigate(`/jovahagyas/${d.id}`)}
                  >
                    <span className="text-[12px] text-ink-1 truncate">{d.title ?? d.type}</span>
                  </div>
                ))}
                <button
                  onClick={() => navigate('/jovahagyas')}
                  className="mt-1 w-full bg-sidebar-bg text-primary text-[12px] font-bold py-2 rounded-[6px]"
                >
                  Jóváhagyások →
                </button>
              </div>
            ) : (
              <div className="bg-off-white border border-rule rounded-card p-3">
                <p className="text-[12px] text-ink-3">Nincs függő jóváhagyás.</p>
              </div>
            )}

            {/* Aktivitás feed */}
            {activity.length > 0 && (
              <>
                <p className="text-[10px] font-semibold text-ink-3 tracking-[0.08em] uppercase mt-1">Ma történt</p>
                <div className="bg-off-white border border-rule rounded-card overflow-hidden">
                  {activity.map((d, i) => (
                    <div
                      key={d.id}
                      className={`flex items-start gap-2 px-3 py-2.5 cursor-pointer hover:bg-cream ${
                        i < activity.length - 1 ? 'border-b border-rule' : ''
                      }`}
                      onClick={() => navigate(`/jovahagyas/${d.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-ink-1 truncate">{d.title ?? d.type}</p>
                        <p className="text-[10px] text-ink-3">{activityLabel(d)}</p>
                      </div>
                      <span className="text-[10px] text-ink-3 shrink-0">{formatTime(d.updatedAt)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Jobb panel — Director chat */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto flex flex-col min-h-0 pb-24">
            <div className="w-full max-w-4xl mx-auto">
              <ChatThread />
            </div>
          </div>
          <div className="sticky bottom-0 pb-3 bg-gradient-to-t from-cream via-cream to-transparent pt-2">
            <div className="max-w-4xl mx-auto">
              <ChatComposer />
            </div>
          </div>
          <div className="h-14 md:hidden shrink-0" />
        </div>

      </div>
    </div>
  );
}
