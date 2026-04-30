import { NavLink } from 'react-router-dom';
import { useMarqueeStore } from '../store/useMarqueeStore.js';

export function BottomNav() {
  const pending = useMarqueeStore((s) => s.awaitingApprovalCount);

  return (
    <nav className="flex md:hidden fixed bottom-0 left-0 right-0 bg-sidebar-bg border-t border-sidebar-border z-50 h-14 overflow-x-auto scrollbar-none">
      <BottomNavItem to="/hq" label="HQ" end />
      <BottomNavItem to="/" label="Workshop" end />
      <BottomNavItem to="/jovahagyas" label="Jóváhagy" badge={pending > 0 ? pending : undefined} />
      <BottomNavItem to="/kampanyok" label="Kampányok" />
      <BottomNavItem to="/memoria" label="Memória" />
      <BottomNavItem to="/ugynokseg" label="Ügynökség" />
    </nav>
  );
}

function BottomNavItem({
  to, label, end, badge,
}: {
  to: string; label: string; end?: boolean; badge?: number;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative flex-none w-[72px] flex items-center justify-center text-[11px] font-medium transition-colors ${
          isActive ? 'text-primary' : 'text-sidebar-text'
        }`
      }
    >
      {badge !== undefined && (
        <span className="absolute top-2 right-1/2 translate-x-3 bg-primary text-sidebar-bg text-[9px] font-bold rounded-chip min-w-[16px] h-[16px] flex items-center justify-center px-0.5">
          {badge}
        </span>
      )}
      {label}
    </NavLink>
  );
}
