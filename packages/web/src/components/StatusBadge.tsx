const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  drafting:          { text: 'Vázlat',           cls: 'bg-secondary-soft text-warning-deep' },
  awaiting_approval: { text: 'Jóváhagyásra vár', cls: 'bg-primary-soft text-primary-hover' },
  shipped:           { text: 'Lezárva',          cls: 'bg-success-soft text-success-deep' },
  archived:          { text: 'Archív',           cls: 'bg-cream text-ink-2' },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { text: status, cls: 'bg-cream text-ink-2' };
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${s.cls}`}>
      {s.text}
    </span>
  );
}
