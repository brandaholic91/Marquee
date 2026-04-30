import { readMemoryFile } from "../memory/read.js";
import { MEMORY_FILES, type MemoryFile } from "../memory/validate.js";
import type { RoleSlug } from "./config.js";

const FILES_FOR_ROLE: Record<RoleSlug, MemoryFile[]> = {
  director: ["profile.md", "brand_voice.md", "ongoing_campaigns.md"],
  copywriter: ["profile.md", "brand_voice.md"],
  "social-manager": ["profile.md", "brand_voice.md"],
  "paid-specialist": ["profile.md", "brand_voice.md"],
  "email-marketer": ["profile.md", "brand_voice.md", "email_list_segments.md"],
  "seo-specialist": ["profile.md", "brand_voice.md", "seo_keyword_bank.md"],
  "brand-voice-guardian": ["profile.md", "brand_voice_guidelines.md"],
};

export async function renderMemoryContext(
  dataDir: string,
  clientSlug: string,
  role: RoleSlug,
): Promise<string> {
  const files = FILES_FOR_ROLE[role];
  const parts: string[] = [];
  for (const f of files) {
    const r = await readMemoryFile(dataDir, clientSlug, f);
    if (!r) continue;
    parts.push(`### memory/${f}\n${r.rawContent.trim()}`);
  }
  if (parts.length === 0) return "";
  return `<memory>\n${parts.join("\n\n")}\n</memory>`;
}

// Mustache-szerű string replace a skill recipe-kben.
// Példa: "{{memory.brand_voice.tone}}" → "barátságos-hozzáértő"
export async function applyMemoryTemplate(
  template: string,
  dataDir: string,
  clientSlug: string,
): Promise<string> {
  const pattern = /\{\{\s*memory\.([a-z_]+)\.([a-z_]+)\s*\}\}/g;
  const referencedFiles = new Set<string>();
  for (const m of template.matchAll(pattern)) {
    referencedFiles.add(`${m[1]}.md`);
  }

  const cache: Record<string, Record<string, unknown>> = {};
  for (const f of referencedFiles) {
    if (!MEMORY_FILES.includes(f as MemoryFile)) {
      cache[f] = {};
      continue;
    }
    const r = await readMemoryFile(dataDir, clientSlug, f);
    cache[f] = r?.frontmatter ?? {};
  }

  return template.replace(pattern, (_, file, key) => {
    const fm = cache[`${file}.md`];
    const value = fm?.[key];
    if (value === undefined || value === null) return "";
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  });
}
