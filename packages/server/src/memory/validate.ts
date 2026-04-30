export type MemoryFile =
  | 'profile.md'
  | 'brand_voice.md'
  | 'ongoing_campaigns.md'
  | 'email_list_segments.md'
  | 'seo_keyword_bank.md'
  | 'brand_voice_guidelines.md';

const REQUIRED: Record<MemoryFile, string[]> = {
  'profile.md': ['business_description', 'target_audience', 'usp', 'competitors'],
  'brand_voice.md': ['tone', 'adjectives', 'reference_brands', 'do', 'dont'],
  'ongoing_campaigns.md': ['campaigns'],
  'email_list_segments.md': ['segments'],
  'seo_keyword_bank.md': ['keywords'],
  'brand_voice_guidelines.md': ['tone', 'tiltott_kifejezesek', 'pelda_jo_mondatok', 'pelda_rossz_mondatok'],
};

export function validateFrontmatter(file: string, fm: Record<string, unknown>): void {
  const required = REQUIRED[file as MemoryFile];
  if (!required) {
    throw new Error(`unknown memory file: ${file}`);
  }
  const missing = required.filter((k) => !(k in fm));
  if (missing.length > 0) {
    throw new Error(`${file}: missing required frontmatter fields: ${missing.join(', ')}`);
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
