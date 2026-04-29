export type MemoryFile = 'profile.md' | 'brand_voice.md' | 'ongoing_campaigns.md';

const REQUIRED: Record<MemoryFile, string[]> = {
  'profile.md': ['business_description', 'target_audience', 'usp', 'competitors'],
  'brand_voice.md': ['tone', 'adjectives', 'reference_brands', 'do', 'dont'],
  'ongoing_campaigns.md': ['campaigns'],
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

export const MEMORY_FILES: MemoryFile[] = ['profile.md', 'brand_voice.md', 'ongoing_campaigns.md'];
