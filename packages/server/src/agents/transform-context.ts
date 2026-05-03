import { readMemoryFile } from "../memory/read.js";
import { MEMORY_FILES, type MemoryFile } from "../memory/validate.js";
import { readWikiPage } from "../memory/wiki.js";
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

const WIKI_FILES_FOR_ROLE: Record<RoleSlug, string[]> = {
	director: ["brand-voice-patterns.md", "seo-learnings.md", "content-performance.md"],
	copywriter: ["brand-voice-patterns.md", "content-performance.md"],
	"social-manager": ["brand-voice-patterns.md", "content-performance.md"],
	"paid-specialist": ["brand-voice-patterns.md", "content-performance.md"],
	"email-marketer": ["brand-voice-patterns.md", "content-performance.md"],
	"seo-specialist": ["seo-learnings.md", "brand-voice-patterns.md"],
	"brand-voice-guardian": [],
};

export async function renderMemoryContext(dataDir: string, clientSlug: string, role: RoleSlug): Promise<string> {
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
export async function applyMemoryTemplate(template: string, dataDir: string, clientSlug: string): Promise<string> {
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

export async function renderBrandVoiceBlock(dataDir: string, clientSlug: string, role: RoleSlug): Promise<string> {
	if (role === "brand-voice-guardian") return "";
	if (process.env.MARQUEE_BRAND_VOICE_INJECTION === "disabled") return "";
	const r = await readMemoryFile(dataDir, clientSlug, "brand_voice_guidelines.md" as MemoryFile);
	if (!r) return "";
	return `=== BRAND VOICE SZABÁLYOK ===\n${r.rawContent.trim()}\n=== / BRAND VOICE SZABÁLYOK VÉGE ===`;
}

export async function renderWikiContext(dataDir: string, clientSlug: string, role: RoleSlug): Promise<string> {
	const files = WIKI_FILES_FOR_ROLE[role] || [];
	const parts: string[] = [];

	for (const f of files) {
		const content = await readWikiPage(dataDir, `clients/${clientSlug}/${f}`);
		if (!content) continue;
		parts.push(`### wiki/${f}\n${content.trim()}`);
	}

	if (parts.length === 0) return "";
	return `<wiki>\n${parts.join("\n\n")}\n</wiki>`;
}
