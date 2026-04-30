export const ROLES: Record<string, { label: string; color: string }> = {
  director:              { label: 'Director',              color: 'bg-primary-soft text-primary-hover' },
  copywriter:            { label: 'Copywriter',            color: 'bg-secondary-soft text-warning-deep' },
  'social-manager':      { label: 'Social Manager',        color: 'bg-success-soft text-success-deep' },
  'paid-specialist':     { label: 'Paid Specialist',       color: 'bg-cream text-ink-1 border border-rule' },
  'email-marketer':      { label: 'Email Marketer',        color: 'bg-primary-soft text-primary-hover' },
  'seo-specialist':      { label: 'SEO Specialist',        color: 'bg-success-soft text-success-deep' },
  'brand-voice-guardian':{ label: 'Brand Voice Guardian',  color: 'bg-secondary-soft text-warning-deep' },
};

export function roleLabel(slug: string): string {
  return ROLES[slug]?.label ?? slug;
}
