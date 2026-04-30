import type { ReactNode } from 'react';

export function SidebarPanel({
  children,
  visible = true,
  fullWidth = false,
}: {
  children: ReactNode;
  visible?: boolean;    // false → "hidden md:flex" (mobilon rejtett, desktopon látható)
  fullWidth?: boolean;  // true → teljes szélességű (mobil full-screen drawer)
}) {
  return (
    <aside
      className={`${visible ? 'flex' : 'hidden md:flex'} ${fullWidth ? 'w-full' : 'w-full md:w-56'} shrink-0 bg-parchment border-r border-rule flex-col overflow-hidden`}
    >
      {children}
    </aside>
  );
}

export function SidebarPanelHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="pl-14 md:pl-4 pr-4 pt-4 pb-3 border-b border-rule flex items-start justify-between gap-2 shrink-0">
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold text-ink-1 tracking-tight">{title}</h2>
        {subtitle && <p className="text-[12px] text-ink-3 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 mt-0.5">{action}</div>}
    </div>
  );
}

export function SidebarPanelBody({ children }: { children: ReactNode }) {
  return <div className="flex-1 overflow-y-auto">{children}</div>;
}

export function SidebarPanelItem({
  children,
  isActive = false,
  onClick,
  dim = false,
}: {
  children: ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  dim?: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
      className={`group w-full text-left px-4 py-2.5 border-l-2 transition-colors cursor-pointer ${
        isActive
          ? 'border-primary bg-cream text-ink-1'
          : 'border-transparent text-ink-2 hover:bg-cream hover:text-ink-1'
      } ${dim ? 'opacity-60' : ''}`}
    >
      {children}
    </div>
  );
}

export function SidebarPanelDivider({ label }: { label: string }) {
  return (
    <div className="px-4 py-2 border-y border-rule">
      <span className="text-[10px] font-semibold text-ink-3 tracking-[0.08em] uppercase">{label}</span>
    </div>
  );
}
