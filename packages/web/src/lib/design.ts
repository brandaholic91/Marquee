// Common card class
export const cardClass = 'border border-rule rounded-lg bg-off-white';

// Status colors keyed for runtime lookup
export const statusColorClass: Record<string, string> = {
  drafting: 'bg-secondary-soft text-warning-deep',
  awaiting_approval: 'bg-primary-soft text-primary-hover',
  shipped: 'bg-success-soft text-success-deep',
  archived: 'bg-cream text-ink-2',
};
