const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  drafting:          { text: 'Folyamatban',      cls: 'bg-primary-soft text-primary-deep' },
  awaiting_eval:     { text: 'Kiértékelés',      cls: 'bg-parchment text-ink-2' },
  awaiting_approval: { text: 'Jóváhagyásra vár', cls: 'bg-primary-soft text-primary-deep' },
  shipped:           { text: 'Lezárva',          cls: 'bg-success-soft text-success-deep' },
  blocked:           { text: 'Blokkolt',         cls: 'bg-danger-soft text-danger-deep' },
  archived:          { text: 'Archív',           cls: 'bg-parchment text-ink-3' },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { text: status, cls: 'bg-parchment text-ink-2' };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-chip ${s.cls}`}>
      {s.text}
    </span>
  );
}
