import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarqueeStore } from '../store/useMarqueeStore.js';
import { dashboardApi, type DeliverableRow } from '../lib/api.js';

const AGENTS = [
  'director', 'copywriter', 'social-manager',
  'paid-specialist', 'email-marketer', 'seo-specialist',
];

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
}

function activityBulb(status: string) {
  if (status === 'shipped') return 'w-1.5 h-1.5 rounded-full bg-success-deep flex-shrink-0 mt-1';
  if (status === 'awaiting_approval') return 'bulb flex-shrink-0 mt-1';
  return 'w-1.5 h-1.5 rounded-full bg-rule-strong flex-shrink-0 mt-1';
}

function activityLabel(d: DeliverableRow) {
  if (d.status === 'shipped') return `Kiszállítva`;
  if (d.status === 'awaiting_approval') return `Elkészült — jóváhagyásra vár`;
  if (d.status === 'drafting') return `Folyamatban`;
  return d.status;
}

export function HQ() {
  const navigate = useNavigate();
  const activeAgents = useMarqueeStore((s) => s.activeAgents);
  const pending = useMarqueeStore((s) => s.awaitingApprovalCount);
  const deliverables = useMarqueeStore((s) => s.deliverables);
  const fetchDeliverables = useMarqueeStore((s) => s.fetchDeliverables);

  const [activity, setActivity] = useState<DeliverableRow[]>([]);

  useEffect(() => {
    fetchDeliverables('awaiting_approval');
    dashboardApi.activity().then((rows) => {
      const sorted = [...rows].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20);
      setActivity(sorted);
    });
  }, [fetchDeliverables]);

  const today = new Date().toLocaleDateString('hu-HU', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  const activeList = AGENTS.filter((r) => activeAgents.has(r));
  const pendingList = deliverables.filter((d) => d.status === 'awaiting_approval').slice(0, 3);

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="px-6 py-4 border-b border-rule flex items-center justify-between bg-cream">
        <div>
          <h1 className="text-[22px] font-extrabold text-ink-1 tracking-tight">Headquarters</h1>
          <p className="text-[12px] text-ink-3 mt-0.5">{today}</p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="bg-primary text-sidebar-bg text-[12px] font-bold px-3.5 py-2 rounded-btn"
        >
          + Új brief
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 grid grid-cols-2 gap-4 content-start">

        {/* Bal — Most */}
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-semibold text-ink-3 tracking-[0.08em] uppercase">Most</p>

          {/* Aktív agent panel */}
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
                  className="flex items-center justify-between bg-cream px-2 py-1.5 rounded-[6px] cursor-pointer hover:bg-parchment"
                  onClick={() => navigate(`/jovahagyas/${d.id}`)}
                >
                  <span className="text-[12px] text-ink-1 truncate">{d.type}</span>
                  <span className="text-[10px] text-ink-3 shrink-0 ml-2">{d.delegationId?.slice(0, 8) ?? ''}</span>
                </div>
              ))}
              <button
                onClick={() => navigate('/jovahagyas')}
                className="mt-1 w-full bg-sidebar-bg text-primary text-[12px] font-bold py-2 rounded-[6px]"
              >
                Jóváhagyások megtekintése →
              </button>
            </div>
          ) : (
            <div className="bg-off-white border border-rule rounded-card p-4">
              <p className="text-[12px] text-ink-3">Nincs függő jóváhagyás.</p>
            </div>
          )}
        </div>

        {/* Jobb — Ma történt */}
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-semibold text-ink-3 tracking-[0.08em] uppercase">Ma történt</p>
          <div className="bg-off-white border border-rule rounded-card overflow-hidden">
            {activity.length === 0 ? (
              <p className="p-4 text-[12px] text-ink-3">Még nincs esemény ma.</p>
            ) : (
              activity.map((d, i) => (
                <div
                  key={d.id}
                  className={`flex items-start gap-2.5 px-3.5 py-3 cursor-pointer hover:bg-cream ${
                    i < activity.length - 1 ? 'border-b border-rule' : ''
                  }`}
                  onClick={() => navigate(`/jovahagyas/${d.id}`)}
                >
                  <span className={activityBulb(d.status)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-ink-1 truncate">{activityLabel(d)}</p>
                    <p className="text-[11px] text-ink-3 mt-0.5">{d.type}</p>
                  </div>
                  <span className="text-[10px] text-ink-3 shrink-0">{formatTime(d.updatedAt)}</span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
