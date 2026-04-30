import { NavLink } from 'react-router-dom';
import { useMarqueeStore } from '../store/useMarqueeStore.js';

const AGENTS = [
  'director', 'copywriter', 'social-manager',
  'paid-specialist', 'email-marketer', 'seo-specialist',
];

export function Sidebar() {
  const pending = useMarqueeStore((s) => s.awaitingApprovalCount);
  const activeAgents = useMarqueeStore((s) => s.activeAgents);

  return (
    <aside className="hidden md:flex w-[180px] shrink-0 bg-sidebar-bg flex-col border-r border-sidebar-border">
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-2.5 border-b border-sidebar-border">
        <div className="w-7 h-7 rounded-[6px] bg-primary flex items-center justify-center shrink-0">
          <span className="text-[13px] font-black text-sidebar-bg leading-none">M</span>
        </div>
        <span className="text-[15px] font-bold text-white tracking-tight">Marquee</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2.5 flex flex-col gap-0.5">
        <SidebarItem to="/hq" label="HQ" end />
        <SidebarItem to="/" label="Workshop" end />
        <SidebarItem to="/jovahagyas" label="Jóváhagyások" badge={pending > 0 ? pending : undefined} />
        <SidebarItem to="/kampanyok" label="Kampányok" />
        <SidebarItem to="/memoria" label="Memória" />
      </nav>

      {/* Agent status */}
      <div className="px-2 py-3 border-t border-sidebar-border">
        <p className="text-[9px] font-semibold text-sidebar-muted tracking-[0.1em] uppercase px-1.5 mb-2">
          Ügynökség
        </p>
        <div className="flex flex-col gap-1">
          {AGENTS.map((role) => (
            <div key={role} className="flex items-center gap-2 px-1.5 py-1">
              {activeAgents.has(role) ? (
                <span className="bulb" />
              ) : (
                <span className="bulb-idle" />
              )}
              <span className="font-mono text-[10px] text-sidebar-muted truncate">
                {role}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function SidebarItem({
  to, label, end, badge,
}: {
  to: string; label: string; end?: boolean; badge?: number;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2 px-2.5 py-2 rounded-[6px] text-[13px] transition-colors ${
          isActive
            ? 'bg-sidebar-active text-primary font-semibold'
            : 'text-sidebar-text hover:bg-sidebar-active'
        }`
      }
    >
      <span className="flex-1">{label}</span>
      {badge !== undefined && (
        <span className="bg-primary text-sidebar-bg text-[10px] font-bold rounded-chip min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {badge}
        </span>
      )}
    </NavLink>
  );
}
