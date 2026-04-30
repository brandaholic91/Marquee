export type MemoryFile =
  | 'profile.md'
  | 'brand_voice.md'
  | 'ongoing_campaigns.md'
  | 'email_list_segments.md'
  | 'seo_keyword_bank.md'
  | 'brand_voice_guidelines.md';

type RequiredField = string | { prefix: string };

const REQUIRED: Record<MemoryFile, RequiredField[]> = {
  'profile.md': ['business_description', 'target_audience', 'usp', 'competitors'],
  'brand_voice.md': ['tone', 'adjectives', 'reference_brands', 'do', 'dont'],
  'ongoing_campaigns.md': ['campaigns'],
  'email_list_segments.md': ['segments'],
  'seo_keyword_bank.md': ['keywords'],
  'brand_voice_guidelines.md': [
    'tone',
    'tiltott_kifejezesek_es_helyettesites',
    { prefix: 'pelda_jo_mondatok' },
    { prefix: 'pelda_rossz_mondatok' },
  ],
};

function fieldLabel(f: RequiredField): string {
  return typeof f === 'string' ? f : `${f.prefix}*`;
}

function fieldSatisfied(f: RequiredField, keys: string[]): boolean {
  if (typeof f === 'string') return keys.includes(f);
  return keys.some((k) => k.startsWith(f.prefix));
}

export function validateFrontmatter(file: string, fm: Record<string, unknown>): void {
  const required = REQUIRED[file as MemoryFile];
  if (!required) {
    throw new Error(`unknown memory file: ${file}`);
  }
  const keys = Object.keys(fm);
  const missing = required.filter((f) => !fieldSatisfied(f, keys));
  if (missing.length > 0) {
    throw new Error(`${file}: missing required frontmatter fields: ${missing.map(fieldLabel).join(', ')}`);
  }
}

export const MEMORY_FILES: MemoryFile[] = [
  'profile.md',
  'brand_voice.md',
  'ongoing_campaigns.md',
  'email_list_segments.md',
  'seo_keyword_bank.md',
  'brand_voice_guidelines.md',
];
