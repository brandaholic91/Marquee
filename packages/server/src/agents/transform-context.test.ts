import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderMemoryContext, applyMemoryTemplate, renderBrandVoiceBlock, renderWikiContext } from "./transform-context.js";
import { writeWikiPage } from "../memory/wiki.js";

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "marquee-tc-"));
	const target = join(dir, "memory", "clients", "default");
	mkdirSync(target, { recursive: true });
	writeFileSync(
		join(target, "profile.md"),
		`---
business_description: "Foo"
target_audience: ["urban"]
usp: "x"
competitors: ["c1"]
---
profile body`,
	);
	writeFileSync(
		join(target, "brand_voice.md"),
		`---
tone: "barátságos-hozzáértő"
adjectives: ["meleg"]
reference_brands: []
do: ["légy konkrét"]
dont: ["ne használj jargont"]
---
voice body`,
	);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("renderMemoryContext", () => {
	it("director gets profile + brand_voice + ongoing_campaigns (skip missing)", async () => {
		const out = await renderMemoryContext(dir, "default", "director");
		expect(out).toContain("<memory>");
		expect(out).toContain("memory/profile.md");
		expect(out).toContain("memory/brand_voice.md");
		expect(out).toContain("Foo");
		expect(out).toContain("barátságos-hozzáértő");
		expect(out).not.toContain("ongoing_campaigns.md");
	});

	it("copywriter gets profile + brand_voice only (no ongoing_campaigns)", async () => {
		const out = await renderMemoryContext(dir, "default", "copywriter");
		expect(out).toContain("memory/profile.md");
		expect(out).toContain("memory/brand_voice.md");
		expect(out).not.toContain("ongoing_campaigns");
	});

	it("returns empty string when client has no memory files", async () => {
		const out = await renderMemoryContext(dir, "ghost-client", "director");
		expect(out).toBe("");
	});

	it("email-marketer gets profile + brand_voice (email_list_segments skipped when missing)", async () => {
		const out = await renderMemoryContext(dir, "default", "email-marketer");
		expect(out).toContain("memory/profile.md");
		expect(out).toContain("memory/brand_voice.md");
		// email_list_segments.md not written in beforeEach, so it should be skipped
		expect(out).not.toContain("email_list_segments");
	});

	it("brand-voice-guardian gets profile (brand_voice_guidelines skipped when missing)", async () => {
		const out = await renderMemoryContext(dir, "default", "brand-voice-guardian");
		expect(out).toContain("memory/profile.md");
		// brand_voice_guidelines.md not written in beforeEach, so it should be skipped
		expect(out).not.toContain("brand_voice_guidelines");
	});
});

describe("applyMemoryTemplate", () => {
	it("substitutes mustache references with frontmatter values", async () => {
		const tpl = "Hangnem: {{memory.brand_voice.tone}}, USP: {{memory.profile.usp}}";
		const out = await applyMemoryTemplate(tpl, dir, "default");
		expect(out).toBe("Hangnem: barátságos-hozzáértő, USP: x");
	});

	it("stringifies array values as JSON", async () => {
		const tpl = "Don't: {{memory.brand_voice.dont}}";
		const out = await applyMemoryTemplate(tpl, dir, "default");
		expect(out).toContain('["ne használj jargont"]');
	});

	it("replaces missing keys with empty string", async () => {
		const tpl = "Missing: [{{memory.profile.nonexistent_key}}]";
		const out = await applyMemoryTemplate(tpl, dir, "default");
		expect(out).toBe("Missing: []");
	});

	it("ignores unknown memory file references safely", async () => {
		const tpl = "Unknown: [{{memory.unknown_file.x}}]";
		const out = await applyMemoryTemplate(tpl, dir, "default");
		expect(out).toBe("Unknown: []");
	});

	it("leaves text without mustache references unchanged", async () => {
		const tpl = "no references here";
		const out = await applyMemoryTemplate(tpl, dir, "default");
		expect(out).toBe("no references here");
	});
});

describe("renderBrandVoiceBlock", () => {
	it("returns empty string when brand_voice_guidelines.md does not exist", async () => {
		const out = await renderBrandVoiceBlock(dir, "default", "copywriter");
		expect(out).toBe("");
	});

	it("wraps brand_voice_guidelines content in the === block", async () => {
		writeFileSync(
			join(dir, "memory", "clients", "default", "brand_voice_guidelines.md"),
			"---\ntone: professional\n---\nUse clear language.",
		);
		const out = await renderBrandVoiceBlock(dir, "default", "copywriter");
		expect(out).toContain("=== BRAND VOICE SZABÁLYOK ===");
		expect(out).toContain("Use clear language.");
		expect(out).toContain("=== / BRAND VOICE SZABÁLYOK VÉGE ===");
	});

	it("returns empty string for brand-voice-guardian (no duplication)", async () => {
		writeFileSync(
			join(dir, "memory", "clients", "default", "brand_voice_guidelines.md"),
			"---\ntone: professional\n---\nUse clear language.",
		);
		const out = await renderBrandVoiceBlock(dir, "default", "brand-voice-guardian");
		expect(out).toBe("");
	});

	it("returns empty string when MARQUEE_BRAND_VOICE_INJECTION=disabled", async () => {
		process.env.MARQUEE_BRAND_VOICE_INJECTION = "disabled";
		writeFileSync(join(dir, "memory", "clients", "default", "brand_voice_guidelines.md"), "Some guidelines.");
		const out = await renderBrandVoiceBlock(dir, "default", "copywriter");
		process.env.MARQUEE_BRAND_VOICE_INJECTION = undefined as unknown as string;
		delete process.env.MARQUEE_BRAND_VOICE_INJECTION;
		expect(out).toBe("");
	});
});

describe("renderWikiContext", () => {
	it("director gets 3 wiki pages: brand-voice-patterns, seo-learnings, content-performance", async () => {
		const wikiTarget = join(dir, "wiki", "clients", "default");
		mkdirSync(wikiTarget, { recursive: true });
		writeFileSync(join(wikiTarget, "brand-voice-patterns.md"), "# Patterns\nBrand voice patterns");
		writeFileSync(join(wikiTarget, "seo-learnings.md"), "# SEO Learnings\nSEO insights");
		writeFileSync(join(wikiTarget, "content-performance.md"), "# Performance\nContent metrics");

		const out = await renderWikiContext(dir, "default", "director");
		expect(out).toContain("<wiki>");
		expect(out).toContain("brand-voice-patterns.md");
		expect(out).toContain("seo-learnings.md");
		expect(out).toContain("content-performance.md");
		expect(out).toContain("Brand voice patterns");
		expect(out).toContain("SEO insights");
		expect(out).toContain("Content metrics");
	});

	it("copywriter gets 2 wiki pages: brand-voice-patterns, content-performance (no seo-learnings)", async () => {
		const wikiTarget = join(dir, "wiki", "clients", "default");
		mkdirSync(wikiTarget, { recursive: true });
		writeFileSync(join(wikiTarget, "brand-voice-patterns.md"), "# Patterns\nBrand voice patterns");
		writeFileSync(join(wikiTarget, "content-performance.md"), "# Performance\nContent metrics");

		const out = await renderWikiContext(dir, "default", "copywriter");
		expect(out).toContain("<wiki>");
		expect(out).toContain("brand-voice-patterns.md");
		expect(out).toContain("content-performance.md");
		expect(out).not.toContain("seo-learnings.md");
	});

	it("seo-specialist gets 2 wiki pages in order: seo-learnings, brand-voice-patterns", async () => {
		const wikiTarget = join(dir, "wiki", "clients", "default");
		mkdirSync(wikiTarget, { recursive: true });
		writeFileSync(join(wikiTarget, "seo-learnings.md"), "# SEO Learnings\nSEO insights");
		writeFileSync(join(wikiTarget, "brand-voice-patterns.md"), "# Patterns\nBrand voice patterns");

		const out = await renderWikiContext(dir, "default", "seo-specialist");
		expect(out).toContain("<wiki>");
		expect(out).toContain("seo-learnings.md");
		expect(out).toContain("brand-voice-patterns.md");
		// Verify order: seo-learnings should appear before brand-voice-patterns
		const seoIndex = out.indexOf("seo-learnings.md");
		const brIndex = out.indexOf("brand-voice-patterns.md");
		expect(seoIndex).toBeLessThan(brIndex);
	});

	it("brand-voice-guardian gets 0 wiki pages", async () => {
		const out = await renderWikiContext(dir, "default", "brand-voice-guardian");
		expect(out).toBe("");
	});

	it("returns empty string when wiki pages do not exist", async () => {
		const out = await renderWikiContext(dir, "default", "director");
		expect(out).toBe("");
	});

	it("skips missing wiki files and includes only available ones", async () => {
		const wikiTarget = join(dir, "wiki", "clients", "default");
		mkdirSync(wikiTarget, { recursive: true });
		// Only write one of the three director files
		writeFileSync(join(wikiTarget, "brand-voice-patterns.md"), "# Patterns\nBrand voice patterns");
		// seo-learnings.md and content-performance.md are missing

		const out = await renderWikiContext(dir, "default", "director");
		expect(out).toContain("<wiki>");
		expect(out).toContain("brand-voice-patterns.md");
		expect(out).not.toContain("seo-learnings.md");
		expect(out).not.toContain("content-performance.md");
	});
});
