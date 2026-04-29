import { NavLink } from 'react-router-dom';
import { useMarqueeStore } from '../store/useMarqueeStore.js';

export function TopNav() {
  const pending = useMarqueeStore((s) => s.awaitingApprovalCount);
  return (
    <header className="border-b border-rule bg-parchment">
      <div className="max-w-screen-xl mx-auto px-8 h-14 flex items-center gap-6">
        <span className="font-serif text-lg font-semibold">MARQUEE</span>
        <nav className="flex gap-2 ml-4">
          <NavItem to="/" label="Műhely" />
          <NavItem to="/jovahagyas" label={`Jóváhagyás${pending > 0 ? ` (${pending})` : ''}`} />
          <NavItem to="/memoria" label="Memória" />
        </nav>
      </div>
    </header>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `px-3 py-1.5 rounded-md text-sm font-medium ${
          isActive ? 'bg-primary-soft text-primary-hover' : 'text-ink-2 hover:bg-cream'
        }`
      }
    >
      {label}
    </NavLink>
  );
}
