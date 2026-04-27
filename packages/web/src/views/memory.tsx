import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface MemoryProposal {
  id: string; file: string; patch: string; status: string; agentSessionId?: string;
}

const MEMORY_FILES = ["client_profile", "brand_guidelines", "ongoing_campaigns", "content_history"];

export function MemoryView() {
  const [proposals, setProposals] = useState<MemoryProposal[]>([]);
  const [selected, setSelected] = useState<string>(MEMORY_FILES[0]);

  const refresh = () => api.memory.proposals().then((ps: MemoryProposal[]) =>
    setProposals(ps.filter((p) => p.status === "pending")),
  );

  useEffect(() => { refresh(); }, []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 border-r border-[hsl(var(--border))] p-4 space-y-1">
        <h2 className="text-xs uppercase font-semibold text-[hsl(var(--muted-foreground))] mb-3">Memory files</h2>
        {MEMORY_FILES.map((f) => (
          <button
            key={f}
            className={`w-full text-left text-sm px-3 py-1.5 rounded transition-colors ${
              selected === f
                ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                : "hover:bg-[hsl(var(--muted))]"
            }`}
            onClick={() => setSelected(f)}
          >
            {f}.md
          </button>
        ))}
      </aside>

      {/* Main area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-3 border-b border-[hsl(var(--border))]">
          <span className="font-mono text-sm">{selected}.md</span>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">(read-only in v0.1 — edit via agent proposals)</span>
        </div>

        {/* Proposal queue */}
        {proposals.length > 0 && (
          <div className="p-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
            <h3 className="text-sm font-semibold mb-2">Pending proposals ({proposals.length})</h3>
            <div className="space-y-2">
              {proposals
                .filter((p) => p.file === selected || p.file === `${selected}.md`)
                .map((p) => (
                  <div key={p.id} className="bg-[hsl(var(--card))] rounded border border-[hsl(var(--border))] p-3">
                    <div className="text-xs text-[hsl(var(--muted-foreground))] mb-2">
                      Proposed change to {p.file}
                    </div>
                    <pre className="text-xs font-mono bg-[hsl(var(--muted))] p-2 rounded overflow-auto max-h-32">
                      {p.patch}
                    </pre>
                    <div className="flex gap-2 mt-2">
                      <button
                        className="text-xs bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-3 py-1 rounded"
                        onClick={() => api.memory.approve(p.id).then(refresh)}
                      >
                        Approve
                      </button>
                      <button
                        className="text-xs border border-[hsl(var(--border))] px-3 py-1 rounded hover:bg-[hsl(var(--muted))]"
                        onClick={() => api.memory.reject(p.id).then(refresh)}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="flex-1 p-6 overflow-auto">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Memory file viewer coming in v0.2. Agent proposals above.
          </p>
        </div>
      </main>
    </div>
  );
}
