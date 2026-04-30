import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentsApi, type AgentSummary } from '../lib/api.js';
import { useMarqueeStore } from '../store/useMarqueeStore.js';

export function Agency() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const activeAgents = useMarqueeStore((s) => s.activeAgents);
  const navigate = useNavigate();

  useEffect(() => {
    agentsApi.list()
      .then(setAgents)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex-1 overflow-auto p-6 md:p-8">
      <h1 className="text-xl font-bold text-ink-1 mb-6">Ügynökség</h1>

      {loading ? (
        <p className="text-sm text-ink-3">Betöltés…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.role}
              agent={agent}
              isActive={activeAgents.has(agent.role)}
              onClick={() => navigate(`/ugynokseg/${agent.role}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentCard({
  agent,
  isActive,
  onClick,
}: {
  agent: AgentSummary;
  isActive: boolean;
  onClick: () => void;
}) {
  const visibleTools = agent.tools.slice(0, 3);
  const hiddenCount = agent.tools.length - visibleTools.length;

  return (
    <button
      onClick={onClick}
      className="text-left bg-white border border-rule rounded-card p-4 hover:border-rule-strong hover:shadow-card transition-all group"
      style={{ boxShadow: '0 1px 3px rgba(28,25,23,0.06)' }}
    >
      <div className="flex items-start gap-2 mb-1">
        <span
          className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-green-500' : 'bg-rule-strong'}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-sm text-ink-1">{agent.name}</span>
            <span className="text-ink-3 group-hover:text-ink-2 text-xs transition-colors">›</span>
          </div>
          {agent.description && (
            <p className="text-xs text-ink-3 mt-0.5 leading-relaxed line-clamp-2">
              {agent.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
          agent.lifecycle === 'warm'
            ? 'bg-primary-soft text-primary-deep border-primary/30'
            : 'bg-parchment text-ink-3 border-rule'
        }`}>
          {agent.lifecycle}
        </span>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-parchment text-ink-2 border border-rule">
          {agent.model}
        </span>
        <span className="text-[10px] text-ink-3">
          {agent.skillCount} skill
        </span>
      </div>

      <div className="mt-2">
        <p className="text-[10px] text-ink-3 leading-relaxed">
          <span className="text-ink-3 mr-1">Tools:</span>
          {visibleTools.join(', ')}
          {hiddenCount > 0 && <span className="text-ink-3 opacity-60"> +{hiddenCount}</span>}
        </p>
      </div>
    </button>
  );
}
