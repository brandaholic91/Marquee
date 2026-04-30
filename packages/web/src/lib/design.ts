// Common card class
export const cardClass = 'border border-rule rounded-lg bg-off-white';

// Status colors keyed for runtime lookup
export const statusColorClass: Record<string, string> = {
  drafting: 'bg-primary-soft text-primary-deep',
  awaiting_eval: 'bg-parchment text-ink-2',
  awaiting_approval: 'bg-primary-soft text-primary-deep',
  shipped: 'bg-success-soft text-success-deep',
  blocked: 'bg-danger-soft text-danger-deep',
  archived: 'bg-parchment text-ink-3',
};
