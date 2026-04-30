import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useMarqueeStore } from '../store/useMarqueeStore.js';

const NAV_ITEMS = [
  { to: '/hq', label: 'HQ', end: true },
  { to: '/', label: 'Workshop', end: true },
  { to: '/jovahagyas', label: 'Jóváhagy' },
  { to: '/kampanyok', label: 'Kampányok' },
  { to: '/memoria', label: 'Memória' },
  { to: '/ugynokseg', label: 'Ügynökség' },
];

export function MobileNavMenu() {
  const [open, setOpen] = useState(false);
  const pending = useMarqueeStore((s) => s.awaitingApprovalCount);

  return (
    <>
      {/* Hamburger gomb — bal felső sarok */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 w-9 h-9 flex items-center justify-center rounded-lg bg-sidebar-bg text-sidebar-text border border-sidebar-border"
        aria-label="Navigáció megnyitása"
      >
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
          <rect width="16" height="2" rx="1" fill="currentColor" />
          <rect y="5" width="16" height="2" rx="1" fill="currentColor" />
          <rect y="10" width="16" height="2" rx="1" fill="currentColor" />
        </svg>
      </button>

      {/* Full-screen overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-[60] bg-sidebar-bg flex flex-col">
          {/* Fejléc */}
          <div className="flex items-center justify-between px-5 h-14 border-b border-sidebar-border shrink-0">
            <span className="text-sm font-bold tracking-widest text-sidebar-text uppercase">
              Marquee
            </span>
            <button
              onClick={() => setOpen(false)}
              className="w-9 h-9 flex items-center justify-center text-sidebar-text text-2xl leading-none hover:text-cream transition-colors"
              aria-label="Bezárás"
            >
              ×
            </button>
          </div>

          {/* Nav linkek */}
          <nav className="flex-1 overflow-auto py-2">
            {NAV_ITEMS.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between px-6 py-4 text-base font-medium border-b border-sidebar-border/40 transition-colors ${
                    isActive
                      ? 'text-primary bg-sidebar-active'
                      : 'text-sidebar-text hover:text-cream hover:bg-sidebar-active'
                  }`
                }
              >
                <span>{label}</span>
                {label === 'Jóváhagy' && pending > 0 && (
                  <span className="bg-primary text-sidebar-bg text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {pending}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
