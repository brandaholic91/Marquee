import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAgencyStore } from "../store/useAgencyStore";
import { agencyEvents } from "../lib/sse";

interface Deliverable { id: string; title: string; status: string; }
interface Thread { id: string; title: string; }
interface AgentSession { id: string; agentSlug: string; }
interface PipelineCount { status: string; count: number; }
interface SnapshotData {
  approvals: Deliverable[];
  pipeline: PipelineCount[];
  activeAgents: AgentSession[];
  threads: Thread[];
}
interface LiveEvent { type: string; payload: unknown; ts: number; }

export function HomeView() {
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const { setSelectedDeliverable, setActiveThread } = useAgencyStore();

  const refresh = () => api.snapshot().then(setSnapshot);

  useEffect(() => {
    refresh();
    agencyEvents.start();
    const unsub = agencyEvents.on("*", (ev) => {
      setLiveEvents((prev) => [{ type: (ev as { type: string }).type, payload: ev, ts: Date.now() }, ...prev].slice(0, 50));
      refresh();
    });
    return () => { unsub(); agencyEvents.stop(); };
  }, []);

  if (!snapshot) return <div className="flex items-center justify-center h-full text-[hsl(var(--muted-foreground))]">Loading…</div>;

  return (
    <div className="p-6 grid grid-cols-2 gap-6 h-full overflow-auto">
      {/* Approvals */}
      <div className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Pending Approvals</h2>
        {snapshot.approvals.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No deliverables awaiting approval.</p>
        ) : (
          <ul className="space-y-2">
            {snapshot.approvals.map((d) => (
              <li key={d.id} className="flex items-center justify-between">
                <button
                  className="text-sm hover:text-[hsl(var(--primary))] text-left"
                  onClick={() => setSelectedDeliverable(d.id)}
                >
                  {d.title}
                </button>
                <button
                  className="text-xs text-[hsl(var(--primary))] hover:underline"
                  onClick={() => api.approvals.decide(d.id, "approved").then(refresh)}
                >
                  Approve
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Live Agent Feed */}
      <div className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 overflow-hidden flex flex-col">
        <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Live Feed</h2>
        <div className="overflow-y-auto flex-1 space-y-1">
          {liveEvents.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Waiting for activity…</p>
          ) : (
            liveEvents.map((e, i) => (
              <div key={i} className="text-xs flex gap-2">
                <span className="text-[hsl(var(--muted-foreground))]">{new Date(e.ts).toLocaleTimeString()}</span>
                <span className="bg-[hsl(var(--muted))] rounded px-1">{e.type}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pipeline */}
      <div className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Pipeline</h2>
        <ul className="space-y-2">
          {snapshot.pipeline.map((p) => (
            <li key={p.status} className="flex justify-between text-sm">
              <span>{p.status.replace(/_/g, " ")}</span>
              <span className="font-mono font-medium">{p.count}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Active Conversations */}
      <div className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Conversations</h2>
        {snapshot.threads.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No active threads.</p>
        ) : (
          <ul className="space-y-2">
            {snapshot.threads.map((t) => (
              <li key={t.id}>
                <button
                  className="text-sm hover:text-[hsl(var(--primary))] text-left"
                  onClick={() => setActiveThread(t.id)}
                >
                  {t.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
